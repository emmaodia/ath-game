import { useEffect, useState } from "react";
import { createPublicClient, http, custom } from "viem";
import { lineaSepolia } from "viem/chains";
import { ABI } from "../abi";
import { useRouter } from "next/router"; // Import router to access query params
import Link from 'next/link'

const publicClient = createPublicClient({
  chain: lineaSepolia,
  transport: http(),
});

export default function MyGames() {
  const router = useRouter(); // Use Next.js router to access passed state
  const [client, setClient] = useState(null);
  const [address, setAddress] = useState(router.query.address || null); // Get the address from the router
  const [connected, setConnected] = useState(router.query.connected === "true"); // Get connected state
  const [gameResults, setGameResults] = useState([]);

  const connectToMetaMask = async () => {
    if (!connected && typeof window !== "undefined" && window.ethereum !== undefined) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletClient = createWalletClient({
          chain: lineaSepolia,
          transport: custom(window.ethereum),
        });
        const [userAddress] = await walletClient.getAddresses();
        setClient(walletClient);
        setAddress(userAddress);
        setConnected(true);
      } catch (error) {
        console.error("User denied account access:", error);
      }
    }
  };

  const fetchGameResults = async () => {
    if (!address) return;

    try {
      const logs = await publicClient.getContractEvents({
        client: publicClient,
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", // Your contract address
        abi: ABI,
        eventName: "GamePlayed",
        fromBlock: 0,
        toBlock: "latest",
        args: [address], // Filter by the current user's address
      });

      const gameData = logs.map((log) => {
        const { player, amount, prediction, houseNumber } = log.args;
        return {
          player,
          amount,
          prediction,
          houseNumber,
        };
      });

      setGameResults(gameData);
    } catch (error) {
      console.error("Failed to fetch game results:", error);
    }
  };

  useEffect(() => {
    if (connected && address) {
      fetchGameResults();
    }
  }, [connected, address]);

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
          <Link href="/">
            <div className="text-blue-500">New Game</div>
          </Link>
          <p>Connected as: {address}</p>
          <h2 className="text-xl font-bold mt-4">Your Game Results</h2>
          <table className="table-auto border-collapse border border-gray-400 mt-4">
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2">Prediction</th>
                <th className="border border-gray-300 px-4 py-2">House Number</th>
                <th className="border border-gray-300 px-4 py-2">Amount (ETH)</th>
              </tr>
            </thead>
            <tbody>
              {gameResults.length > 0 ? (
                gameResults.map((game, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-2">{game.prediction}</td>
                    <td className="border border-gray-300 px-4 py-2">{game.houseNumber}</td>
                    <td className="border border-gray-300 px-4 py-2">{game.amount} ETH</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center py-4">
                    No games played yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
