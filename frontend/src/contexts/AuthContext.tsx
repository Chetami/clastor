import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserInfo } from "@examify-tms/interfaces";
import { login, signOut, verifyToken } from "../services/authService";

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuthState: (user: UserInfo, token: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("jwtToken");
    if (savedToken) {
      // Verify token is still valid
      verifyToken(savedToken)
        .then((user) => {
          setUser(user);
        })
        .catch(() => {
          localStorage.removeItem("jwtToken");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const response = await login(email, password);
    setUser(response.user);
    localStorage.setItem("jwtToken", response.jwtToken);
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    localStorage.removeItem("jwtToken");
  };

  const setAuthState = (user: UserInfo, token: string) => {
    setUser(user);
    localStorage.setItem("jwtToken", token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: handleLogin,
        logout: handleLogout,
        setAuthState,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
