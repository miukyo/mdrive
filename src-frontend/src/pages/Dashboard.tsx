import {
  Avatar,
  Button,
  Description,
  Dropdown,
  Header,
  IconPlus,
  IconSearch,
  Label,
  Separator,
  Surface,
} from "@heroui/react";
import React, { useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../stores/Auth.store";
import { useFilesStore } from "../stores/Files.store";
import { useIndexStore } from "../stores/Index.store";
import { useProgressStore } from "../stores/Progress.store";
import {
  IconBoxMultiple,
  IconBoxMultipleFilled,
  IconCategoryFilled,
  IconLogout,
  IconMoonStars,
  IconPaperclip,
  IconPhotoFilled,
  IconSettingsFilled,
  IconSun,
  IconTrashFilled,
  IconUserPlus,
} from "@tabler/icons-react";
import { Route, useLocation } from "wouter";
import Home from "./Dashboard/Home";
import GlobalPreview from "../components/GlobalPreview";
import Gallery from "./Dashboard/Gallery";
import Shared from "./Dashboard/Shared";

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "tertiary" | "secondary";
  className?: string;
}

const NavButton = ({
  icon,
  label,
  onClick,
  variant = "ghost",
  className = "",
}: NavButtonProps) => {
  const isActive = variant === "primary";
  return (
    <Button
      size="lg"
      variant={variant}
      onClick={onClick}
      className={`p-8 hover:shadow-background transition-all gap-0 rounded-2xl group ${isActive ? "" : "[&>svg,&>span]:opacity-70"} ${className}`}
    >
      {icon}
      <span className="group-hover:ml-2 max-w-0 group-hover:max-w-40 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap">
        {label}
      </span>
    </Button>
  );
};

export default function Dashboard() {
  const { user, sessions, sessionId, logout, switchSession } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      sessions: state.sessions,
      sessionId: state.sessionId,
      logout: state.logout,
      switchSession: state.switchSession,
    })),
  );
  const { uploadFiles } = useFilesStore();
  const initProgress = useProgressStore((state) => state.init);
  const [location, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherSessions = useMemo(() => {
    return sessions.filter((s) => s.id !== sessionId);
  }, [sessions, sessionId]);
  const [isDark, setIsDark] = React.useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
      // Reset input
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!user?.username) {
      navigate("~/");
      return;
    }
    initProgress();
  }, [user?.username, navigate, initProgress]);

  if (!user?.username) {
    return null;
  }

  return (
    <div className="flex h-screen gap-1 overflow-y-scroll px-2">
      <div className="w-20 flex flex-col gap-2 z-10 sticky left-0 top-0 pt-2">
        <div className="flex flex-col gap-1">
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <Button
            size="lg"
            variant="tertiary"
            className="p-8 justify-start rounded-full group"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconPlus className="size-5" />
          </Button>
          <NavButton
            icon={<IconCategoryFilled className="size-5" />}
            label="Home"
            variant={location === "/" ? "primary" : "ghost"}
            onClick={() => navigate("/")}
          />
          <NavButton
            icon={<IconPhotoFilled className="size-5" />}
            label="Gallery"
            variant={location === "/gallery" ? "primary" : "ghost"}
            onClick={() => navigate("/gallery")}
          />
          <NavButton
            icon={<IconBoxMultipleFilled className="size-5" />}
            label="Shared"
            variant={location === "/shared" ? "primary" : "ghost"}
            onClick={() => navigate("/shared")}
          />
          <NavButton
            icon={<IconTrashFilled className="size-5" />}
            label="Trash"
            variant={location === "/trash" ? "primary" : "ghost"}
            onClick={() => navigate("/trash")}
          />
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 sticky top-2 z-10">
          <div className="h-full flex items-center justify-between">
            <Button
              size="lg"
              variant="tertiary"
              className="p-8 justify-start rounded-full"
            >
              <IconSearch className="size-5" />
              Search
            </Button>
            <div className="flex items-center gap-1">
              <Dropdown>
                <Button
                  size="lg"
                  variant="tertiary"
                  className="p-3 pr-8 py-8 rounded-l-4xl rounded-r-xl! justify-start text-left text-lg min-w-[200px]"
                >
                  <Avatar size="md">
                    <Avatar.Image
                      alt={user?.firstName || ""}
                      src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
                    />
                    <Avatar.Fallback>
                      {user?.firstName?.charAt(0)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <Label>{user?.firstName}</Label>
                    <Description>@{user.username}</Description>
                  </div>
                </Button>
                <Dropdown.Popover placement="top right">
                  <Dropdown.Menu
                    onAction={(key) => {
                      if (key === "logout") {
                        logout();
                      } else if (key === "add") {
                        navigate("~/auth");
                      } else if (
                        typeof key === "string" &&
                        key.startsWith("switch:")
                      ) {
                        const sid = key.replace("switch:", "");
                        switchSession(sid);
                      }
                    }}
                  >
                    <Dropdown.Section>
                      <Header>Switch accounts</Header>
                      <Dropdown.Item
                        id="profile"
                        className="h-16 gap-2 opacity-100 cursor-default"
                        textValue="Profile"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar size="md">
                            <Avatar.Image
                              alt={user?.firstName || ""}
                              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
                            />
                            <Avatar.Fallback>
                              {user?.firstName?.charAt(0)}
                            </Avatar.Fallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <Label>{user?.firstName} (Current)</Label>
                            <Description>@{user.username}</Description>
                          </div>
                        </div>
                      </Dropdown.Item>
                    </Dropdown.Section>

                    {otherSessions.length > 0 && (
                      <>
                        <Separator />
                        <Dropdown.Section>
                          {otherSessions.map((session) => (
                            <Dropdown.Item
                              id={`switch:${session.id}`}
                              textValue={session.user.firstName || ""}
                              key={session.id}
                              className="h-16"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar size="sm" className="size-8">
                                  <Avatar.Fallback>
                                    {session.user.firstName?.charAt(0)}
                                  </Avatar.Fallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <Label>{session.user.firstName}</Label>
                                  <Description className="text-tiny">
                                    @{session.user.username}
                                  </Description>
                                </div>
                              </div>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Section>
                      </>
                    )}

                    <Separator />
                    <Dropdown.Section>
                      <Header>Actions</Header>
                      <Dropdown.Item id="add" textValue="Add account">
                        <IconUserPlus size={18} />
                        <Label>Add account</Label>
                      </Dropdown.Item>

                      <Dropdown.Item
                        id="logout"
                        variant="danger"
                        textValue="Log Out"
                      >
                        <IconLogout size={18} />
                        <Label>Log Out</Label>
                      </Dropdown.Item>
                    </Dropdown.Section>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              <Dropdown>
                <Button
                  size="lg"
                  variant="tertiary"
                  className="p-8 justify-start rounded-r-4xl rounded-l-xl"
                >
                  <IconSettingsFilled className="size-5" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    onAction={(key) => {
                      if (key === "theme") toggleTheme();
                    }}
                  >
                    <Dropdown.Section>
                      <Header>Settings</Header>
                      <Dropdown.Item id="theme" textValue="Toggle Theme">
                        {isDark ? (
                          <IconSun size={18} />
                        ) : (
                          <IconMoonStars size={18} />
                        )}
                        <Label>{isDark ? "Light Mode" : "Dark Mode"}</Label>
                      </Dropdown.Item>
                    </Dropdown.Section>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </div>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/gallery">
          <Gallery />
        </Route>
        <Route path="/shared">
          <Shared />
        </Route>
        <Route path="/trash">trash</Route>
      </div>
      <GlobalPreview />
    </div>
  );
}
