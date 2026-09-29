// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";
import {IdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol";
import {Token} from "@tokenysolutions/t-rex/contracts/token/Token.sol";

/// @notice Reads deployments/<network>.json, then onboards ONE demo investor
///         (deploy ONCHAINID -> sign+add KYC claim -> register -> mint).
contract Bootstrap is Script {
    uint256 constant TOPIC_KYC = 1;
    uint256 constant SCHEME_ECDSA = 1;
    uint16 constant US = 840;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address investor = vm.envOr(
            "DEMO_INVESTOR",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
        );
        uint256 amount = vm.envOr("MINT_AMOUNT", uint256(1_000 ether));

        string memory path = string.concat(
            "./deployments/",
            _networkName(),
            ".json"
        );
        string memory json = vm.readFile(path);
        IdentityRegistry ir = IdentityRegistry(
            vm.parseJsonAddress(json, ".identityRegistry")
        );
        Token token = Token(vm.parseJsonAddress(json, ".token"));
        address issuerAddr = vm.parseJsonAddress(json, ".claimIssuer");

        bytes memory kyc = abi.encode("PASSED_KYC");

        vm.startBroadcast(pk);

        // demo investor's ONCHAINID (managed by deployer for bootstrap convenience)
        Identity demoId = new Identity(vm.addr(pk), false);

        // deployer is the trusted issuer in V1 -> sign the claim with the deployer key
        bytes32 message = keccak256(
            abi.encode(address(demoId), TOPIC_KYC, kyc)
        );
        bytes32 prefixed = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);

        demoId.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerAddr, sig, kyc, "");
        ir.registerIdentity(investor, IIdentity(address(demoId)), US);
        token.mint(investor, amount);

        vm.stopBroadcast();

        console2.log("Demo investor:", investor);
        console2.log("Investor ONCHAINID:", address(demoId));
        console2.log("Minted (wei):", amount);
    }

    function _networkName() internal view returns (string memory) {
        if (block.chainid == 31337) return "anvil";
        if (block.chainid == 11155111) return "sepolia";
        return vm.toString(block.chainid);
    }
}
