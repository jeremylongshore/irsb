import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DisputeEscalated,
  EvidenceSubmitted,
  ArbitrationResolved,
} from "../generated/DisputeModule/DisputeModule";
import { Dispute } from "../generated/schema";

export function handleDisputeEscalated(event: DisputeEscalated): void {
  let dispute = Dispute.load(event.params.disputeId);
  if (!dispute) return;

  dispute.escalated = true;
  dispute.escalatedAt = event.block.timestamp;
  dispute.arbitrator = event.params.arbitrator;
  dispute.save();
}

export function handleEvidenceSubmitted(event: EvidenceSubmitted): void {
  let dispute = Dispute.load(event.params.disputeId);
  if (!dispute) return;

  // Add evidence hash to the list
  let hashes = dispute.evidenceHashes;
  hashes.push(event.params.evidenceHash);
  dispute.evidenceHashes = hashes;
  dispute.save();
}

export function handleArbitrationResolved(event: ArbitrationResolved): void {
  let dispute = Dispute.load(event.params.disputeId);
  if (!dispute) return;

  dispute.arbitrationResolved = true;
  dispute.solverFault = event.params.solverFault;
  dispute.slashAmount = event.params.slashAmount;
  dispute.arbitrationReason = event.params.reason;
  dispute.resolvedAt = event.block.timestamp;
  dispute.resolved = true;
  dispute.slashed = event.params.solverFault;
  dispute.save();
}
