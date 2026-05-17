import {
  Avatar,
  Button,
  Description,
  Dropdown,
  Header,
  IconSearch,
  Label,
  Separator,
} from "@heroui/react";
import React, { useEffect, useRef, useMemo } from "react";

import { useShallow } from "zustand/react/shallow";
import { useAuthStore, API_BASE_URL } from "../stores/Auth.store";
import { useFilesStore } from "../stores/Files.store";
import { useProgressStore } from "../stores/Progress.store";
import {
  IconArchiveFilled,
  IconBoxMultipleFilled,
  IconCategoryFilled,
  IconLogout,
  IconMoonStars,
  IconPhotoFilled,
  IconSettingsFilled,
  IconSun,
  IconUpload,
  IconUserPlus,
} from "@tabler/icons-react";
import { Route, useLocation } from "wouter";
import Home from "./Dashboard/Home";
import GlobalPreview from "../components/GlobalPreview";
import Gallery from "./Dashboard/Gallery";
import Shared from "./Dashboard/Shared";
import Explorer from "./Dashboard/Explorer";
import SearchModal from "../components/SearchModal";
import { useThemeStore } from "../stores/Theme.store";

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
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const { theme: isDark, toggleTheme: toggleThemeStore } = useThemeStore();

  const toggleTheme = () => {
    toggleThemeStore();
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
    <div className="flex w-full h-screen gap-1 overflow-hidden">
      <div
        className="flex-1 overflow-y-scroll h-full"
        style={{
          scrollbarGutter: "stable both-edges",
        }}
      >
        <div className="sticky top-0 z-50 isolate px-2">
          <div className="bg-linear-to-b from-background to-transparent h-full py-2 flex justify-between gap-2 max-sm:gap-1 overflow-x-auto no-scrollbar max-sm:justify-start max-sm:flex-nowrap w-full">
            <div className="flex gap-1 max-sm:contents">
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
                className="p-8 max-sm:p-3.5 justify-start group max-md:rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload className="size-5" />
              </Button>

              <Button
                size="lg"
                className="p-8 max-sm:p-3.5 justify-start rounded-full"
                variant={location === "/" ? "primary" : "ghost"}
                onClick={() => navigate("/")}
              >
                <IconCategoryFilled className="size-5" />
                <span className="hidden xl:inline">Home</span>
              </Button>
              <Button
                size="lg"
                className="p-8 max-sm:p-3.5 justify-start rounded-full"
                variant={location === "/explorer" ? "primary" : "ghost"}
                onClick={() => navigate("/explorer")}
              >
                <IconArchiveFilled className="size-5" />
                <span className="hidden xl:inline">Explorer</span>
              </Button>
              <Button
                size="lg"
                className="p-8 max-sm:p-3.5 justify-start rounded-full"
                variant={location === "/gallery" ? "primary" : "ghost"}
                onClick={() => navigate("/gallery")}
              >
                <IconPhotoFilled className="size-5" />
                <span className="hidden xl:inline">Gallery</span>
              </Button>

              <Button
                size="lg"
                className="p-8 max-sm:p-3.5 justify-start rounded-full"
                variant={location === "/shared" ? "primary" : "ghost"}
                onClick={() => navigate("/shared")}
              >
                <IconBoxMultipleFilled className="size-5" />
                <span className="hidden xl:inline">Shared</span>
              </Button>
            </div>

            <div className="flex gap-1 max-sm:contents">
              <Button
                size="lg"
                variant="tertiary"
                className="p-8 max-sm:p-3.5 justify-start rounded-full"
                onClick={() => setIsSearchOpen(true)}
              >
                <IconSearch className="size-5" />
                <span className="hidden xl:inline">Search</span>
              </Button>
              <Dropdown>
                <Button
                  size="lg"
                  variant="tertiary"
                  className="p-3 py-4 xl:pr-8 sm:py-8 rounded-l-4xl rounded-r-xl! justify-start text-left text-lg min-w-max xl:min-w-[200px]"
                >
                  <Avatar size="md" className="max-sm:size-8 max-sm:min-w-8">
                    <Avatar.Image
                      alt={user?.firstName || ""}
                      src={`${API_BASE_URL}/auth/avatar?session_id=${sessionId}`}
                    />
                    <Avatar.Fallback>
                      {user?.firstName?.charAt(0)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="flex flex-col hidden xl:flex">
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
                              src={`${API_BASE_URL}/auth/avatar?session_id=${sessionId}`}
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
                                  <Avatar.Image
                                    alt={session.user.firstName || ""}
                                    src={`${API_BASE_URL}/auth/avatar?session_id=${session.id}`}
                                  />
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
                  className="p-8 max-sm:p-3.5 justify-start rounded-r-4xl rounded-l-xl"
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

        <div className="p-4">
          <Route path="/">
            <Home />
          </Route>
          <Route path="/gallery">
            <Gallery />
          </Route>
          <Route path="/shared">
            <Shared />
          </Route>
          <Route path="/explorer">
            <Explorer />
          </Route>
        </div>
      </div>
      <GlobalPreview />
      <SearchModal isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  );
}
