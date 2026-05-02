import {
  Avatar,
  Button,
  Description,
  IconPlus,
  IconSearch,
  Label,
  Surface,
} from "@heroui/react";
import React, { useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useAuthStore } from "../stores/Auth.store";
import {
  IconBoxMultiple,
  IconBoxMultipleFilled,
  IconCategoryFilled,
  IconLogout,
  IconPaperclip,
  IconPhotoFilled,
  IconSettingsFilled,
  IconTrashFilled,
} from "@tabler/icons-react";
import { Route, useLocation } from "wouter";
import Home from "./Dashboard/Home";

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
      className={`p-8 transition-all gap-0 rounded-2xl group ${isActive ? "" : "[&>svg,&>span]:opacity-70"} ${className}`}
    >
      {icon}
      <span className="group-hover:ml-2 max-w-0 group-hover:max-w-40 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap">
        {label}
      </span>
    </Button>
  );
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen gap-1 p-2">
      <div
        className="w-20 flex flex-col gap-2 z-10"
        style={{ viewTransitionName: "sidebar" } as any}
      >
        <div className="flex flex-col gap-1">
          <Button
            size="lg"
            variant="tertiary"
            className="p-8 justify-start rounded-full group"
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
      <div
        className="flex-1 overflow-auto"
        style={{ viewTransitionName: "content" } as any}
      >
        <div className="h-16">
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
              <Button
                size="lg"
                variant="tertiary"
                className="p-3 pr-8 py-8 rounded-l-4xl rounded-r-xl! justify-start text-left text-lg"
              >
                <Avatar size="md">
                  <Avatar.Image
                    alt={user?.firstName}
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
              <Button
                size="lg"
                variant="tertiary"
                className="p-8 justify-start rounded-r-4xl rounded-l-xl opacity-70"
              >
                <IconSettingsFilled className="size-5" />
              </Button>
            </div>
          </div>
        </div>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/gallery">gallery</Route>
        <Route path="/shared">shared</Route>
        <Route path="/trash">trash</Route>
      </div>
    </div>
  );
}
