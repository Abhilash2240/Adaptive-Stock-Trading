import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";

import App from "./App";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";

initMonitoring();

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI ?? window.location.origin;

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Auth0Provider
			domain={domain}
			clientId={clientId}
			authorizationParams={{
				redirect_uri: redirectUri,
				audience,
				scope: "openid profile email",
			}}
			cacheLocation="localstorage"
			useRefreshTokens={true}
		>
			<App />
		</Auth0Provider>
	</StrictMode>,
);
