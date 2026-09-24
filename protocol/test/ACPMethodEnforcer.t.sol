// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ACPMethodEnforcer } from "../src/enforcers/ACPMethodEnforcer.sol";
import { IAgenticCommerce } from "../src/interfaces/IAgenticCommerce.sol";
import { ICaveatEnforcer } from "../src/interfaces/ICaveatEnforcer.sol";

contract ACPMethodEnforcerTest is Test {
    ACPMethodEnforcer public enforcer;

    function setUp() public {
        enforcer = new ACPMethodEnforcer();
    }

    // ============ Allowed Methods ============

    function test_AllowedMethods_AcceptJob() public view {
        bytes memory callData = abi.encodeWithSelector(IAgenticCommerce.acceptJob.selector, uint256(1));

        // Should not revert
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    function test_AllowedMethods_SubmitResult() public view {
        bytes memory callData =
            abi.encodeWithSelector(IAgenticCommerce.submitResult.selector, uint256(1), keccak256("result"));

        // Should not revert
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    // ============ Denied Methods ============

    function test_DeniedMethods_ClaimRefund() public {
        bytes memory callData = abi.encodeWithSelector(IAgenticCommerce.claimRefund.selector, uint256(1));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICaveatEnforcer.CaveatViolation.selector, "ACP method not allowed for delegated agent"
            )
        );
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    function test_DeniedMethods_CompleteJob() public {
        bytes memory callData = abi.encodeWithSelector(IAgenticCommerce.completeJob.selector, uint256(1));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICaveatEnforcer.CaveatViolation.selector, "ACP method not allowed for delegated agent"
            )
        );
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    function test_DeniedMethods_RejectJob() public {
        bytes memory callData = abi.encodeWithSelector(IAgenticCommerce.rejectJob.selector, uint256(1), "reason");

        vm.expectRevert(
            abi.encodeWithSelector(
                ICaveatEnforcer.CaveatViolation.selector, "ACP method not allowed for delegated agent"
            )
        );
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    function test_DeniedMethods_FundJob() public {
        bytes memory callData = abi.encodeWithSelector(IAgenticCommerce.fundJob.selector, uint256(1));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICaveatEnforcer.CaveatViolation.selector, "ACP method not allowed for delegated agent"
            )
        );
        enforcer.beforeHook("", bytes32(0), address(0), address(0), callData, 0);
    }

    // ============ Edge Cases ============

    function test_EmptyCallData_Passes() public view {
        // Plain ETH transfer — no selector to check, should pass
        enforcer.beforeHook("", bytes32(0), address(0), address(0), "", 0);
    }

    function test_ShortCallData_Passes() public view {
        // Less than 4 bytes — no selector, should pass
        enforcer.beforeHook("", bytes32(0), address(0), address(0), hex"aabbcc", 0);
    }

    function test_AfterHook_NoOp() public view {
        // afterHook should not revert for any input
        enforcer.afterHook("", bytes32(0), address(0), address(0), "", 0);
    }
}
