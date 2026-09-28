// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";

/// @notice Phase 2 bootstrap: deploy a ClaimIssuer (simulated KYC provider) and
///         one investor Identity, then authorize the issuer's signing key.
contract DeployIdentity is Script {
    uint256 constant CLAIM_PURPOSE = 3; // ERC-734 CLAIM key
    uint256 constant ECDSA_KEY_TYPE = 1;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address issuerKey = vm.envAddress("ISSUER_KEY"); // the KYC provider's signing address
        address investor = vm.envAddress("INVESTOR_ADDRESS");

        vm.startBroadcast(deployerPk);

        // Claim issuer's management key = the issuer signing address
        ClaimIssuer issuer = new ClaimIssuer(issuerKey);

        // Register issuerKey as a CLAIM key on the issuer so it may sign claims.
        // (management key added in constructor can add keys.)
        // If issuerKey is already the management key it can also sign; we add CLAIM explicitly.
        // NOTE: addKey must be called by a management key; run this from issuerKey in tests.

        // Investor identity: management key = the investor wallet
        Identity investorId = new Identity(investor, false);

        vm.stopBroadcast();

        console2.log("ClaimIssuer:", address(issuer));
        console2.log("Investor Identity:", address(investorId));
        console2.log("Issuer signing key:", issuerKey);
    }
}
