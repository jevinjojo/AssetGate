// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title PermissionedToken (Phase 0 thin-slice ONLY)
/// @notice A deliberately minimal ERC-20-style token whose every transfer is
///         gated by a hardcoded whitelist. This is NOT ERC-3643 — it exists
///         only to prove the end-to-end pipe: chain -> indexer -> DB -> API -> UI.
///         The real T-REX identity/compliance engine replaces this in later phases.
contract PermissionedToken {
    string public name = "AssetGate Demo";
    string public symbol = "AGDEMO";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice The "gate": only whitelisted addresses may send or receive.
    mapping(address => bool) public whitelist;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event WhitelistUpdated(address indexed account, bool allowed);

    error NotOwner();
    error NotWhitelisted(address account);
    error InsufficientBalance();
    error InsufficientAllowance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        // Owner is whitelisted so it can receive the initial mint and seed transfers.
        whitelist[msg.sender] = true;
        emit WhitelistUpdated(msg.sender, true);
    }

    function setWhitelist(address account, bool allowed) external onlyOwner {
        whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (!whitelist[to]) revert NotWhitelisted(to);
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount); // mint == Transfer from the zero address
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    /// @dev THE GATE. Both sides must be whitelisted, or the transfer reverts.
    function _transfer(address from, address to, uint256 amount) internal {
        if (!whitelist[from]) revert NotWhitelisted(from);
        if (!whitelist[to]) revert NotWhitelisted(to);
        if (balanceOf[from] < amount) revert InsufficientBalance();

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
