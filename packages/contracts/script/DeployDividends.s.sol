// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {DividendDistributor} from "../src/dividends/DividendDistributor.sol";

contract DeployDividends is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        MockUSDC usdc = new MockUSDC();
        DividendDistributor dist = new DividendDistributor(address(usdc));
        usdc.mint(deployer, 1_000_000 ether); // issuer's payout funds
        vm.stopBroadcast();

        string memory o = "div";
        vm.serializeAddress(o, "mockUSDC", address(usdc));
        string memory j = vm.serializeAddress(
            o,
            "dividendDistributor",
            address(dist)
        );
        vm.writeJson(
            j,
            string.concat("./deployments/", _net(), "-dividends.json")
        );
        console2.log("MockUSDC:", address(usdc));
        console2.log("DividendDistributor:", address(dist));
    }
    function _net() internal view returns (string memory) {
        if (block.chainid == 31337) return "anvil";
        if (block.chainid == 11155111) return "sepolia";
        return vm.toString(block.chainid);
    }
}
