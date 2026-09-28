// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {ClaimTopicsRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {IdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol";

contract DeployRegistries is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPk);

        ClaimTopicsRegistry ctr = new ClaimTopicsRegistry();
        ctr.init();

        TrustedIssuersRegistry tir = new TrustedIssuersRegistry();
        tir.init();

        IdentityRegistryStorage irs = new IdentityRegistryStorage();
        irs.init();

        IdentityRegistry ir = new IdentityRegistry();
        ir.init(address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir));

        vm.stopBroadcast();

        console2.log("ClaimTopicsRegistry:  ", address(ctr));
        console2.log("TrustedIssuersReg:    ", address(tir));
        console2.log("IdentityRegStorage:   ", address(irs));
        console2.log("IdentityRegistry:     ", address(ir));
    }
}
