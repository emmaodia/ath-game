import { useEffect, useState, useCallback } from "react";
import {
  createPublicClient,
  http,
  parseEther,
  formatEther,
  parseEventLogs,
} from "viem";
import { baseSepolia } from "viem/chains";
import { ABI } from "../abi"; // Ensure ABI is correctly imported
import {
  ConnectWallet,
  ConnectWalletText,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownLink,
} from "@coinbase/onchainkit/wallet";
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import {
  Transaction,
  TransactionButton,
} from "@coinbase/onchainkit/transaction";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Confetti from "react-confetti";
import { useWindowSize } from "@reactuses/core";

const CONTRACT_ADDRESS = "0x07Cf79DBCd0C5095D9127B35891bB95d18590595";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(
    "https://base-sepolia.g.alchemy.com/v2/K0GOKN0kYyTR3UXRycMmVTpZ7V1TwyrG"
  ),
});

export default function Home() {
  const { address } = useAccount();
  const [houseBalance, setHouseBalance] = useState(null);
  const [prediction, setPrediction] = useState(""); // User input for prediction
  const [betAmount, setBetAmount] = useState(""); // Amount to bet
  const [transactionHash, setTransactionHash] = useState(""); // Transaction hash
  const [gameResult, setGameResult] = useState(""); // Game result (win/loss)
  const [isLoading, setIsLoading] = useState(false); // Loading state for transaction
  const [vrfLoading, setVrfLoading] = useState(false); // Loading state for VRF
  const [gameInProgress, setGameInProgress] = useState(true); // Track if a game is in progress

  const { width, height } = useWindowSize();

  const handleOnStatus = useCallback(async (status) => {
    console.log("LifecycleStatus", status);
    if (status?.statusData?.transactionReceipts?.[0]?.transactionHash) {
      const hash = status.statusData.transactionReceipts[0].transactionHash;
      setTransactionHash(hash);
      console.log(hash);
      await receipt(hash); // Pass the hash directly to `receipt`
    }
  }, []);

  // Async function to wait for transaction receipt and handle events
  const receipt = async (transactionHash) => {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

      console.log("Transaction receipt:", receipt);

      // Start the VRF process after confirming transaction
      setTimeout(async () => {
        try {
          const logs_receipt = await publicClient.getTransactionReceipt({
            hash: receipt.transactionHash,
          });

          const logs = parseEventLogs({
            abi: ABI,
            logs: logs_receipt.logs,
          });
          console.log(logs);

          const gamePlayedLog = logs.find(
            (log) => log.eventName === "GamePlayed"
          );

          if (!gamePlayedLog) {
            console.error("GamePlayed event not found.");
            return;
          }

          const requestId = gamePlayedLog.args.requestId;

          // Wait for 30 seconds before calling getRequestStatus
          setTimeout(() => {
            getRequestStatus(requestId);
          }, 30000);
        } catch (error) {
          console.error("Error fetching logs after delay:", error);
        }
      }, 30000); // 30 seconds in milliseconds

      setIsLoading(false); // Stop loading for transaction submission
      setVrfLoading(true); // Start loading for VRF event
    } catch (error) {
      console.error("Error waiting for transaction receipt:", error);
      toast.error("Failed to confirm transaction!", {
        position: "top-right",
        autoClose: 3000,
      });
      setIsLoading(false);
      setVrfLoading(false);
    }
  };

  // Function to fetch request status using requestId
  const getRequestStatus = async (requestId) => {
    try {
      const status = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getRequestStatus",
        args: [requestId],
      });

      console.log("Request Status:", status);

      const won = status[4]; // Assuming the won status is the 5th value returned

      if (won) {
        setGameResult("You won the game!");
        toast.success("Congratulations! You won!", {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        setGameResult("You lost the game.");
        toast.warn("Sorry, you lost. Better luck next time!", {
          position: "top-right",
          autoClose: 3000,
        });
      }

      setVrfLoading(false); // Stop VRF loading
      setGameInProgress(false); // End the current game
      setPrediction(""); // Clear the form inputs
      setBetAmount(""); // Clear the form inputs
    } catch (error) {
      console.error("Error fetching request status:", error);
      toast.error("Failed to fetch game result!", {
        position: "top-right",
        autoClose: 3000,
      });
      setVrfLoading(false); // Stop VRF loading on error
    }
  };

  const contracts = [
    {
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "play",
      args: [parseInt(prediction, 10)],
      value: parseEther(betAmount), // Correctly parse to Wei
    },
  ];

  // Input validation
  const handlePredictionChange = (e) => {
    const value = e.target.value;
    if (value >= 0 && value <= 9) {
      setPrediction(value);
    } else {
      toast.error("Prediction must be between 0 and 9", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const handleBetAmountChange = (e) => {
    const value = e.target.value;

    // Only allow valid numbers with up to 18 decimal places
    const regex = /^\d*(\.\d{0,18})?$/;

    if (regex.test(value)) {
      setBetAmount(value);
    }
  };

  const fetchHouseBalance = async () => {
    try {
      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "houseBalance",
      });
      setHouseBalance(formatEther(balance));
    } catch (error) {
      console.error("Failed to fetch house balance:", error);
    }
  };

  const handleNewGame = () => {
    setGameInProgress(true);
    setGameResult("");
  };

  useEffect(() => {
    if (address) {
      fetchHouseBalance();
    }
  }, [address]);

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <ToastContainer />
      <div className="pt-4 pr-4">
        <div className="flex justify-end">
          <div className="wallet-container">
            <Wallet>
              <ConnectWallet>
                <ConnectWalletText>Log In</ConnectWalletText>
                <Avatar className="h-6 w-6" />
                <Name className="text-white" />
              </ConnectWallet>
              {address && (
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownLink
                    icon="wallet"
                    href="https://keys.coinbase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wallet
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              )}
            </Wallet>
          </div>
        </div>
      </div>

      <main className="flex min-h-screen flex-col items-center p-24">
        <div className="max-w-4xl w-full p-4">
          {address ? (
            <div>
              {houseBalance !== null ? (
                <p>House Balance: {houseBalance} Ether</p>
              ) : (
                <p>Loading House Balance...</p>
              )}

              {gameInProgress ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Prediction (0-9):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      value={prediction}
                      onChange={handlePredictionChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Bet Amount (in ETH):
                    </label>
                    <input
                      type="number"
                      min="0.0001" // Set a minimum value to ensure at least 0.0001 ETH is entered
                      step="0.0001"
                      value={betAmount}
                      onChange={handleBetAmountChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <Transaction
                    chainId={baseSepolia.id}
                    contracts={contracts}
                    onStatus={handleOnStatus}
                  >
                    <TransactionButton className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                      {isLoading ? "Processing..." : "Play"}
                    </TransactionButton>
                  </Transaction>

                  {isLoading && (
                    <div className="mt-4">
                      <p>Submitting transaction...</p>
                    </div>
                  )}

                  {vrfLoading && (
                    <div className="mt-4">
                      <p>Waiting for VRF confirmation...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  {gameResult && (
                    <div>
                      <p>{gameResult}</p>
                      {gameResult.includes("won") && (
                        <div>
                          <Confetti
                            width={300}
                            height={200}
                            numberOfPieces={300}
                            recycle={true}
                          />
                          <p className="text-green-500 font-bold">
                            Congratulations! You won!
                          </p>
                        </div>
                      )}
                      {gameResult.includes("lost") && (
                        <p className="text-red-500 font-bold">
                          Sorry, you lost. Better luck next time!
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleNewGame}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
                  >
                    Start New Game
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p>Please, log in to connect your wallet and play.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
