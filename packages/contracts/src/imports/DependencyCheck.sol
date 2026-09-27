// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Phase 1 sanity check ONLY. This contract is never deployed. It exists so that
// `forge build` is forced to resolve every external dependency remapping.
// If this file compiles, the OpenZeppelin + ONCHAINID + T-REX wiring is correct.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";
import {IToken} from "@tokenysolutions/t-rex/contracts/token/IToken.sol";
import {IIdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/interface/IIdentityRegistry.sol";
import {IModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/IModularCompliance.sol";

/// @dev State vars reference each imported type so nothing is stripped as unused.
contract DependencyCheck {
    IERC20 public erc20; // OpenZeppelin (regular)
    IERC20Upgradeable public erc20Upgradeable; // OpenZeppelin (upgradeable) -> proves OZ v4
    IIdentity public identity; // ONCHAINID (ERC-734/735)
    IToken public token; // ERC-3643 token interface
    IIdentityRegistry public identityRegistry; // ERC-3643 identity gate
    IModularCompliance public compliance; // ERC-3643 compliance gate
}
