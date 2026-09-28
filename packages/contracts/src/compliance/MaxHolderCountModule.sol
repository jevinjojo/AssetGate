// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AbstractModule} from "@tokenysolutions/t-rex/contracts/compliance/modular/modules/AbstractModule.sol";

/// @title MaxHolderCountModule
/// @notice A custom ERC-3643 compliance module that caps the number of DISTINCT
///         token holders per compliance contract. There is no built-in T-REX
///         module for this, so we implement the full IModule surface ourselves.
/// @dev "Holder" == an address whose tracked balance is > 0. We maintain the
///      count ourselves using the post-action hooks, because the compliance
///      layer never passes us balances — only the deltas of what just happened.
contract MaxHolderCountModule is AbstractModule {
    // --- per-compliance configuration & state ---

    /// @notice max distinct holders allowed, keyed by the compliance contract
    mapping(address => uint256) public maxHolders;

    /// @notice current distinct-holder count, keyed by the compliance contract
    mapping(address => uint256) public holderCount;

    /// @notice our own shadow balance ledger, so we can detect 0 -> >0 and >0 -> 0
    ///         transitions. Keyed by (compliance, investor).
    mapping(address => mapping(address => uint256)) private _balance;

    event MaxHoldersSet(address indexed compliance, uint256 max);

    /// @notice Owner of the *compliance* sets its cap. `onlyComplianceCall`
    ///         (from AbstractModule) ensures msg.sender is the bound compliance,
    ///         so it is invoked via compliance.callModuleFunction(...).
    function setMaxHolders(
        address _compliance,
        uint256 _max
    ) external onlyComplianceCall {
        maxHolders[_compliance] = _max;
        emit MaxHoldersSet(_compliance, _max);
    }

    // --- THE GATE (view): would this action keep us within the cap? ---

    /// @dev Called by ModularCompliance.canTransfer for every prospective move.
    ///      We only need to block transfers/mints that would create a NEW holder
    ///      beyond the cap. If `to` already holds tokens, holder count won't grow.
    function moduleCheck(
        address _from,
        address _to,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        uint256 cap = maxHolders[_compliance];
        if (cap == 0) return true; // 0 == "no limit configured"

        bool toIsNewHolder = _balance[_compliance][_to] == 0 && _value > 0;
        if (!toIsNewHolder) return true; // recipient already counted → no growth

        // `from` might drop to zero in this same move (transfer of full balance),
        // freeing a slot. Mints have _from == address(0), which never frees a slot.
        bool fromWillEmpty = _from != address(0) &&
            _balance[_compliance][_from] == _value;

        uint256 projected = holderCount[_compliance] +
            1 -
            (fromWillEmpty ? 1 : 0);
        return projected <= cap;
    }

    // --- BOOKKEEPING (state): update our ledger AFTER a successful action ---

    function moduleTransferAction(
        address _from,
        address _to,
        uint256 _value
    ) external override onlyComplianceCall {
        _decrease(msg.sender, _from, _value);
        _increase(msg.sender, _to, _value);
    }

    function moduleMintAction(
        address _to,
        uint256 _value
    ) external override onlyComplianceCall {
        _increase(msg.sender, _to, _value);
    }

    function moduleBurnAction(
        address _from,
        uint256 _value
    ) external override onlyComplianceCall {
        _decrease(msg.sender, _from, _value);
    }

    /// @dev increment shadow balance; if it crosses 0 -> >0, count a new holder.
    function _increase(
        address _compliance,
        address _who,
        uint256 _value
    ) private {
        if (_value == 0) return;
        uint256 prev = _balance[_compliance][_who];
        if (prev == 0) holderCount[_compliance] += 1; // became a holder
        _balance[_compliance][_who] = prev + _value;
    }

    /// @dev decrement shadow balance; if it crosses >0 -> 0, drop a holder.
    function _decrease(
        address _compliance,
        address _who,
        uint256 _value
    ) private {
        if (_value == 0) return;
        uint256 prev = _balance[_compliance][_who];
        uint256 next = prev - _value; // T-REX guarantees sufficient balance upstream
        _balance[_compliance][_who] = next;
        if (next == 0 && prev != 0) holderCount[_compliance] -= 1; // no longer a holder
    }

    // --- module metadata / binding ---

    /// @notice can this module bind to the given compliance? (no preconditions)
    function canComplianceBind(
        address /*_compliance*/
    ) external view override returns (bool) {
        return true;
    }

    /// @notice true = safe to add even after the token has history.
    /// @dev We return FALSE: our holder count must be initialised from an empty
    ///      state, so this module should be bound before minting begins.
    function isPlugAndPlay() external pure override returns (bool) {
        return false;
    }

    function name() external pure override returns (string memory) {
        return "MaxHolderCountModule";
    }
}
