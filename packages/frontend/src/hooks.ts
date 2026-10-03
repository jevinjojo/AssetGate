import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

/** Wraps a write + receipt wait into one status object. */
export function useContractAction() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  return { writeContract, hash, isPending, isConfirming, isSuccess, error, reset };
}