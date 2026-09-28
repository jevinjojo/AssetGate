// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AbstractModule} from "@tokenysolutions/t-rex/contracts/compliance/modular/modules/AbstractModule.sol";
import {IModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/IModularCompliance.sol";
import {IToken} from "@tokenysolutions/t-rex/contracts/token/IToken.sol";
import {IIdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/interface/IIdentityRegistry.sol";

/// @title CountryRestrictModule
/// @notice Custom compliance module: an allow-list of investor country codes.
/// @dev Reads the recipient's registered country from the token's IdentityRegistry.
contract CountryRestrictModule is AbstractModule {
    mapping(address => mapping(uint16 => bool)) public allowedCountry; // compliance => country => allowed

    event CountryAllowed(
        address indexed compliance,
        uint16 country,
        bool allowed
    );

    function setCountryAllowed(
        address _compliance,
        uint16 _country,
        bool _allowed
    ) external onlyComplianceCall {
        allowedCountry[_compliance][_country] = _allowed;
        emit CountryAllowed(_compliance, _country, _allowed);
    }

    function moduleCheck(
        address,
        address _to,
        uint256,
        address _compliance
    ) external view override returns (bool) {
        address tokenAddr = IModularCompliance(_compliance).getTokenBound();
        IIdentityRegistry reg = IToken(tokenAddr).identityRegistry();
        uint16 country = reg.investorCountry(_to);
        return allowedCountry[_compliance][country];
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
        return "CountryRestrictModule";
    }
}
