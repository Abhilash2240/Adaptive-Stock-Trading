import { createContext, useContext, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface AuthUser {
  id: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  created_at?: string;
  is_active?: boolean;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const mappedUser: AuthUser | null = user
    ? {
        id: user.sub ?? user.email ?? "",
        sub: user.sub ?? "",
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.email ?? user.name ?? user.sub,
        is_active: true,
      }
    : null;

  const login = () => {
    void loginWithRedirect();
  };

  const logout = () =>
    auth0Logout({
      logoutParams: {
        returnTo: import.meta.env.VITE_AUTH0_REDIRECT_URI ?? window.location.origin,
      },
    });

  const getToken = async (): Promise<string> => {
    return await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user: mappedUser,
        token: null,
        login,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
