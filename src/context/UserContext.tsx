import { createContext, useContext, useState, ReactNode } from "react";

interface UserInfo {
  name: string;
  role: string;
}

interface UserContextType {
  user: UserInfo;
  setUser: (u: UserInfo) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: { name: "", role: "" },
  setUser: () => {},
  logout: () => {},
});

export const useUser = () => useContext(UserContext);

function getUserFromStorage(): UserInfo {
  try {
    const token = localStorage.getItem("token");
    if (!token) return { name: "", role: "" };
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem("token");
      return { name: "", role: "" };
    }
    if (payload.name) return { name: payload.name, role: payload.role || "" };
  } catch {
    // malformed token — clear it
    localStorage.removeItem("token");
  }
  return { name: "", role: "" };
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserInfo>(getUserFromStorage);

  const setUser = (u: UserInfo) => {
    setUserState(u);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUserState({ name: "", role: "" });
    // TODO: redirect to ${API_URL}/auth/logout once the backend endpoint is implemented
    window.location.href = "/login";
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
