// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {PermissionedToken} from "../src/PermissionedToken.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address investor = vm.envAddress("INVESTOR_ADDRESS");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        PermissionedToken token = new PermissionedToken();

        // Whitelist a verified investor (Anvil account #1)
        token.setWhitelist(investor, true);

        // Mint 1,000,000 tokens to the owner (already whitelisted)
        token.mint(deployer, 1_000_000 ether);

        // Seed one compliant transfer: owner -> investor (both whitelisted)
        token.transfer(investor, 250_000 ether);

        vm.stopBroadcast();

        console2.log("Token deployed at:", address(token));
        console2.log("Owner (whitelisted):", deployer);
        console2.log("Investor (whitelisted):", investor);
    }
}
