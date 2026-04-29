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
    if (payload.name) return { name: payload.name, role: payload.role || "" };
  } catch {
    // malformed token — ignore
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
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
