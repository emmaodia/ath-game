import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  parseEther,
  createWalletClient,
  custom,
  formatEther,
  parseAbiItem,
} from "viem";
import { baseSepolia } from "viem/chains";
import { ABI } from "../abi"; // Ensure ABI is correctly imported

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const CONTRACT_ADDRESS = "0xA936953aDD9E88fd32990Dbe62D83AbE84ba5226";

export default function Home() {
  const [client, setClient] = useState(null);
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [houseBalance, setHouseBalance] = useState(null);
  const [prediction, setPrediction] = useState(""); // User input for prediction
  const [betAmount, setBetAmount] = useState(""); // Amount to bet
  const [transactionHash, setTransactionHash] = useState(""); // Transaction hash
  const [gameResult, setGameResult] = useState(""); // Game result (win/loss)
  const [isLoading, setIsLoading] = useState(false); // Loading state for transaction
  const [vrfLoading, setVrfLoading] = useState(false); // Loading state for VRF
  const [vrfCompleted, setVrfCompleted] = useState(false); // VRF completion state

  // Function to connect to MetaMask and create a wallet client
  const connectToMetaMask = async () => {
    if (typeof window !== "undefined" && window.ethereum !== undefined) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: custom(window.ethereum),
        });
        const [userAddress] = await walletClient.getAddresses();
        setClient(walletClient);
        setAddress(userAddress);
        setConnected(true);
        console.log("Connected account:", userAddress);
      } catch (error) {
        console.error("User denied account access:", error);
      }
    } else {
      console.log(
        "MetaMask is not installed or not running in a browser environment!"
      );
    }
  };

  // Fetch the house balance from the contract
  const fetchHouseBalance = async () => {
    try {
      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESS, // New contract address
        abi: ABI,
        functionName: "houseBalance",
      });
      setHouseBalance(formatEther(balance));
    } catch (error) {
      console.error("Failed to fetch house balance:", error);
    }
  };

  // Handle game play logic (submitting transaction)
  const handlePlay = async (event) => {
    event.preventDefault();

    if (!client || !address) {
      console.error("Client or address not available");
      return;
    }

    setIsLoading(true); // Start loading for transaction submission

    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: CONTRACT_ADDRESS, // New contract address
        abi: ABI,
        functionName: "play",
        args: [parseInt(prediction, 10)], // Ensure prediction is an integer
        value: parseEther(betAmount), // Convert bet amount to wei
      });

      if (!request) {
        console.error("Simulation failed to return a valid request object.");
        setIsLoading(false);
        return;
      }

      // Submit transaction
      const hash = await client.writeContract(request);
      setTransactionHash(hash);

      // Wait for the transaction to be confirmed
      await publicClient.waitForTransactionReceipt({ hash });

      setIsLoading(false); // Stop loading for transaction submission
      setVrfLoading(true); // Start loading for VRF event

      // Wait for 3 minutes (180000 ms) before fetching VRF events
      setTimeout(() => {
        fetchGameEvents();
        console.log("here");
      }, 90000); // 180000 milliseconds = 3 minutes
    } catch (error) {
      console.error("Transaction or simulation failed:", error);
      setIsLoading(false); // Stop loading on error
    }
  };

  // Fetch VRF results (GameWon or GameLost events)
  const fetchGameEvents = async () => {
    try {
      // We wait for GameWon or GameLost events after VRF completion
      console.log("Listening for VRF confirmation events...");

      const wonLogs = await publicClient.getContractEvents({
        client: publicClient,
        address: CONTRACT_ADDRESS, // Contract address
        abi: ABI,
        eventName: "GameWon",
        // fromBlock: "latest",
      });

      // console.log(wonLogs);

      if (wonLogs.length > 0) {
        console.log("GameWon event logs:", wonLogs);
        setGameResult("You won the game!");
        setVrfCompleted(true); // VRF process is completed
        setVrfLoading(false); // Stop VRF loading
        return;
      }

      const filter = await publicClient.createEventFilter({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        event: parseAbiItem(
          "event GamePlayed(address indexed player, uint256 amount, uint256 prediction, uint256 requestId)"
        ),
        fromBlock: 16493251n,
        // toBlock: "latest",
      });

      console.log(filter);

      const lostLogs = await publicClient.getContractEvents({
        client: publicClient,
        address: CONTRACT_ADDRESS, // Contract address
        abi: ABI,
        eventName: "GameLost",
        // fromBlock: "latest",
      });

      if (lostLogs.length > 0) {
        console.log("GameLost event logs:", lostLogs);
        setGameResult("You lost the game.");
        setVrfCompleted(true); // VRF process is completed
        setVrfLoading(false); // Stop VRF loading
      }
    } catch (error) {
      console.error("Error fetching VRF events:", error);
      setVrfLoading(false); // Stop VRF loading on error
    }
  };

  // Fetch house balance when the client and address are ready
  useEffect(() => {
    if (client && address) {
      fetchHouseBalance();
    }
  }, [client, address]);

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      {!connected ? (
        <button
          onClick={connectToMetaMask}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <p>Connected as: {address}</p>
          {houseBalance !== null ? (
            <p>House Balance: {houseBalance} Ether</p>
          ) : (
            <p>Loading House Balance...</p>
          )}

          <form onSubmit={handlePlay} className="mt-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Prediction (0-9):
              </label>
              <input
                type="number"
                min="0"
                max="9"
                value={prediction}
                onChange={(e) => setPrediction(e.target.value)}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Bet Amount (in ETH):
              </label>
              <input
                type="text"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Play
            </button>
          </form>

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

          {vrfCompleted && gameResult && (
            <div className="mt-4">
              <p>{gameResult}</p>
              {gameResult.includes("won") && (
                <p className="text-green-500 font-bold">
                  Congratulations! You won!
                </p>
              )}
              {gameResult.includes("lost") && (
                <p className="text-red-500 font-bold">
                  Sorry, you lost. Better luck next time!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
