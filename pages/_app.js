import "@/styles/globals.css";
import "@coinbase/onchainkit/styles.css";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { baseSepolia } from "wagmi/chains";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { http, cookieStorage, createConfig, createStorage } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [
      coinbaseWallet({
        appName: "OnchainKit",
        preference: "smartWalletOnly",
        version: "4",
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
    },
  });
}

export default function App({ Component, pageProps }) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
        >
          <Component {...pageProps} />;
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
