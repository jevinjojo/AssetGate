// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AbstractModule} from "@tokenysolutions/t-rex/contracts/compliance/modular/modules/AbstractModule.sol";
import {IModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/IModularCompliance.sol";
import {IToken} from "@tokenysolutions/t-rex/contracts/token/IToken.sol";

/// @title BalanceCapModule
/// @notice Custom compliance module: caps how many tokens any single wallet may hold.
/// @dev Reads the recipient's live balance from the bound token, so it needs no
///      internal bookkeeping (plug-and-play). The compliance layer calls this in
///      canTransfer BEFORE balances move, so balanceOf(to)+value is the projection.
contract BalanceCapModule is AbstractModule {
    mapping(address => uint256) public maxBalance; // per compliance

    event MaxBalanceSet(address indexed compliance, uint256 max);

    function setMaxBalance(
        address _compliance,
        uint256 _max
    ) external onlyComplianceCall {
        maxBalance[_compliance] = _max;
        emit MaxBalanceSet(_compliance, _max);
    }

    function moduleCheck(
        address,
        address _to,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        uint256 cap = maxBalance[_compliance];
        if (cap == 0) return true; // 0 == no cap
        address tokenAddr = IModularCompliance(_compliance).getTokenBound();
        return IToken(tokenAddr).balanceOf(_to) + _value <= cap;
    }

    function moduleTransferAction(
        address,
        address,
        uint256
    ) external override onlyComplianceCall {}
    function moduleMintAction(
        address,
        uint256
    ) external override onlyComplianceCall {}
    function moduleBurnAction(
        address,
        uint256
    ) external override onlyComplianceCall {}
    function canComplianceBind(address) external pure override returns (bool) {
        return true;
    }
    function isPlugAndPlay() external pure override returns (bool) {
        return true;
    }
    function name() external pure override returns (string memory) {
        return "BalanceCapModule";
    }
}
