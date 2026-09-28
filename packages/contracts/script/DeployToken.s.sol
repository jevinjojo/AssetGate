// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {Token} from "@tokenysolutions/t-rex/contracts/token/Token.sol";

/// @notice Deploys the ERC-3643 Token and binds it to a pre-deployed
///         IdentityRegistry + ModularCompliance (addresses from Phase 3/4).
contract DeployToken is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address identityRegistry = vm.envAddress("IDENTITY_REGISTRY");
        address compliance = vm.envAddress("COMPLIANCE");

        vm.startBroadcast(pk);

        Token token = new Token();
        token.init(
            identityRegistry,
            compliance,
            "AssetGate Token",
            "AGT",
            18,
            address(0)
        );

        vm.stopBroadcast();
        console2.log("Token:", address(token));
    }
}
