// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console2} from "forge-std/Script.sol";

import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IClaimIssuer} from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

import {ClaimTopicsRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {IdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol";
import {ModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/ModularCompliance.sol";
import {Token} from "@tokenysolutions/t-rex/contracts/token/Token.sol";

import {MaxHolderCountModule} from "../src/compliance/MaxHolderCountModule.sol";
import {BalanceCapModule} from "../src/compliance/BalanceCapModule.sol";
import {CountryRestrictModule} from "../src/compliance/CountryRestrictModule.sol";

/// @notice Deploys + wires + configures the full ERC-3643 suite and writes
///         deployments/<network>.json. State vars hold addresses to avoid
///         "stack too deep".
contract DeployAll is Script {
    uint256 constant TOPIC_KYC = 1;
    uint256 constant CLAIM_PURPOSE = 3;
    uint256 constant ECDSA_KEY_TYPE = 1;
    uint16 constant US = 840;

    // deployed addresses (state, not locals)
    address deployer;
    ClaimTopicsRegistry ctr;
    TrustedIssuersRegistry tir;
    IdentityRegistryStorage irs;
    IdentityRegistry ir;
    ModularCompliance compliance;
    Token token;
    ClaimIssuer issuer;
    MaxHolderCountModule holderModule;
    BalanceCapModule balanceModule;
    CountryRestrictModule countryModule;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(pk);

        string memory tokenName = vm.envOr(
            "TOKEN_NAME",
            string("AssetGate Token")
        );
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("AGT"));
        uint256 maxHolders = vm.envOr("MAX_HOLDERS", uint256(500));
        uint256 maxBalance = vm.envOr("MAX_BALANCE", uint256(1_000_000 ether));

        vm.startBroadcast(pk);

        // 1) registries, in dependency order
        ctr = new ClaimTopicsRegistry();
        ctr.init();
        tir = new TrustedIssuersRegistry();
        tir.init();
        irs = new IdentityRegistryStorage();
        irs.init();
        ir = new IdentityRegistry();
        ir.init(address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir));

        // 2) compliance + token
        compliance = new ModularCompliance();
        compliance.init();
        token = new Token();
        token.init(
            address(ir),
            address(compliance),
            tokenName,
            tokenSymbol,
            18,
            address(0)
        );
        compliance.bindToken(address(token));

        // 3) simulated KYC issuer (deployer is the trusted issuer in V1)
        issuer = new ClaimIssuer(deployer);
        issuer.addKey(
            keccak256(abi.encode(deployer)),
            CLAIM_PURPOSE,
            ECDSA_KEY_TYPE
        );

        // 4) required topic + trust the issuer
        ctr.addClaimTopic(TOPIC_KYC);
        uint256[] memory topics = new uint256[](1);
        topics[0] = TOPIC_KYC;
        tir.addTrustedIssuer(IClaimIssuer(address(issuer)), topics);

        // 5) compliance modules (holder module bound before any mint)
        holderModule = new MaxHolderCountModule();
        compliance.addModule(address(holderModule));
        compliance.callModuleFunction(
            abi.encodeWithSelector(
                MaxHolderCountModule.setMaxHolders.selector,
                address(compliance),
                maxHolders
            ),
            address(holderModule)
        );

        balanceModule = new BalanceCapModule();
        compliance.addModule(address(balanceModule));
        compliance.callModuleFunction(
            abi.encodeWithSelector(
                BalanceCapModule.setMaxBalance.selector,
                address(compliance),
                maxBalance
            ),
            address(balanceModule)
        );

        countryModule = new CountryRestrictModule();
        compliance.addModule(address(countryModule));
        compliance.callModuleFunction(
            abi.encodeWithSelector(
                CountryRestrictModule.setCountryAllowed.selector,
                address(compliance),
                US,
                true
            ),
            address(countryModule)
        );

        // 6) agents
        ir.addAgent(deployer);
        token.addAgent(deployer);

        vm.stopBroadcast();

        _writeArtifact();
    }

    function _writeArtifact() internal {
        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "deployer", deployer);
        vm.serializeAddress(o, "claimTopicsRegistry", address(ctr));
        vm.serializeAddress(o, "trustedIssuersRegistry", address(tir));
        vm.serializeAddress(o, "identityRegistryStorage", address(irs));
        vm.serializeAddress(o, "identityRegistry", address(ir));
        vm.serializeAddress(o, "modularCompliance", address(compliance));
        vm.serializeAddress(o, "claimIssuer", address(issuer));
        vm.serializeAddress(o, "maxHolderCountModule", address(holderModule));
        vm.serializeAddress(o, "balanceCapModule", address(balanceModule));
        vm.serializeAddress(o, "countryRestrictModule", address(countryModule));
        string memory finalJson = vm.serializeAddress(
            o,
            "token",
            address(token)
        );

        string memory path = string.concat(
            "./deployments/",
            _networkName(),
            ".json"
        );
        vm.writeJson(finalJson, path);
        console2.log("Wrote artifact:", path);
        console2.log("Token:", address(token));
    }

    function _networkName() internal view returns (string memory) {
        if (block.chainid == 31337) return "anvil";
        if (block.chainid == 11155111) return "sepolia";
        return vm.toString(block.chainid);
    }
}
