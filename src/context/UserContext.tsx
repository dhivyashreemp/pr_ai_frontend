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
  user: { name: "user", role: "" },
  setUser: () => {},
  logout: () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserInfo>({ name: "user", role: "" });

  const setUser = (u: UserInfo) => {
    setUserState(u);
  };

  const logout = () => {
    setUserState({ name: "user", role: "" });
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
