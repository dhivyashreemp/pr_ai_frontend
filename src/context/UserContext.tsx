import { createContext, useContext, useState, ReactNode } from "react";
import { API_URL } from "@/constants";

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
    const raw = localStorage.getItem("userInfo");
    if (!raw) return { name: "", role: "" };
    const info = JSON.parse(raw);
    if (info.name) return { name: info.name, role: info.role || "" };
  } catch {
    localStorage.removeItem("userInfo");
  }
  return { name: "", role: "" };
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserInfo>(getUserFromStorage);

  const setUser = (u: UserInfo) => {
    localStorage.setItem("userInfo", JSON.stringify(u));
    setUserState(u);
  };

  const logout = () => {
    localStorage.removeItem("userInfo");
    setUserState({ name: "", role: "" });
    window.location.href = `${API_URL}/auth/logout`;
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
