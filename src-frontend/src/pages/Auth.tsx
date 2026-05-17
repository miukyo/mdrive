import React, { useState, useReducer } from "react";
import {
  Button,
  Card,
  Description,
  Form,
  InputGroup,
  InputOTP,
  Label,
  TextField,
} from "@heroui/react";
import { IconDeviceMobile } from "@tabler/icons-react";
import PixelBlast from "../components/PixelBackground";
import { useAuthStore } from "../stores/Auth.store";

type setModeFunction = React.Dispatch<
  React.SetStateAction<"login" | "register">
>;

const LoginForm = ({ setMode }: { setMode: setModeFunction }) => {
  const { login } = useAuthStore();
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || !pin) {
      setError("Please fill in all fields");
      return;
    }
    if (pin.length !== 6) {
      setError("PIN must be 6 digits");
      return;
    }
    login(phone, pin).then((result) => {
      if (result.success) {
        // Success logic
      } else {
        setError(result.message || "An unknown error occurred");
      }
    });
  };
  return (
    <Form onSubmit={handleSubmit}>
      <Card.Content>
        {error && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <TextField name="phone" type="phone">
            <Label className="ml-1">Phone</Label>
            <Description>Enter your phone number</Description>
            <InputGroup variant="secondary">
              <InputGroup.Prefix>
                <IconDeviceMobile width={16} />
              </InputGroup.Prefix>
              <InputGroup.Input
                placeholder="+621234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </InputGroup>
          </TextField>
          <TextField name="otp" type="number">
            <Label className="ml-1">PIN</Label>
            <Description>Enter the 6-digit PIN</Description>
            <InputOTP
              variant="secondary"
              maxLength={6}
              value={pin}
              onChange={setPin}
            >
              <InputOTP.Group>
                <InputOTP.Slot index={0} />
                <InputOTP.Slot index={1} />
                <InputOTP.Slot index={2} />
                <InputOTP.Slot index={3} />
                <InputOTP.Slot index={4} />
                <InputOTP.Slot index={5} />
              </InputOTP.Group>
            </InputOTP>
          </TextField>
        </div>
      </Card.Content>
      <Card.Footer className="mt-4 flex flex-col gap-2">
        <Button className="w-full" type="submit">
          Sign In
        </Button>
        <Button
          className="w-full"
          variant="tertiary"
          onClick={() => setMode("register")}
        >
          Register
        </Button>
      </Card.Footer>
    </Form>
  );
};

type RegisterState = {
  pinMode: boolean;
  phone: string;
  pin: string;
  otp: string;
  error: string | null;
};

type RegisterAction =
  | { type: "SET_PIN_MODE"; payload: boolean }
  | { type: "SET_PHONE"; payload: string }
  | { type: "SET_PIN"; payload: string }
  | { type: "SET_OTP"; payload: string }
  | { type: "SET_ERROR"; payload: string | null };

function registerReducer(
  state: RegisterState,
  action: RegisterAction,
): RegisterState {
  switch (action.type) {
    case "SET_PIN_MODE":
      return { ...state, pinMode: action.payload };
    case "SET_PHONE":
      return { ...state, phone: action.payload };
    case "SET_PIN":
      return { ...state, pin: action.payload };
    case "SET_OTP":
      return { ...state, otp: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

const RegisterForm = ({ setMode }: { setMode: setModeFunction }) => {
  const [state, dispatch] = useReducer(registerReducer, {
    pinMode: false,
    phone: "",
    pin: "",
    otp: "",
    error: null,
  });

  const [otpSent, setOtpSent] = useState(0);

  const { pinMode, phone, pin, otp, error } = state;
  const {
    register,
    sendOtp,
    setPin: setPinStore,
    completeRegistration,
  } = useAuthStore();

  const handleOtp = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    if (!phone) {
      dispatch({ type: "SET_ERROR", payload: "Please fill in all fields" });
      return;
    }
    setOtpSent(1);
    sendOtp(phone).then((result) => {
      if (result.success) {
        setOtpSent(2);
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: result.message || "Failed to send OTP",
        });
      }
    });
  };

  const handleSkipPin = () => {
    completeRegistration();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    if (!phone) {
      dispatch({ type: "SET_ERROR", payload: "Please fill in all fields" });
      return;
    }
    if (otp.length < 5) {
      dispatch({ type: "SET_ERROR", payload: "OTP is too short" });
      return;
    }

    if (!pinMode) {
      register(otp).then((result) => {
        if (result.success) {
          dispatch({ type: "SET_PIN_MODE", payload: true });
        } else {
          dispatch({
            type: "SET_ERROR",
            payload: result.message || "Registration failed",
          });
        }
      });
    } else {
      if (!pin || pin.length !== 6) {
        dispatch({ type: "SET_ERROR", payload: "PIN must be 6 digits" });
        return;
      }
      setPinStore(pin).then((result) => {
        if (result.success) {
          completeRegistration();
        } else {
          dispatch({
            type: "SET_ERROR",
            payload: result.message || "Failed to set PIN",
          });
        }
      });
    }
  };
  return (
    <Form onSubmit={handleSubmit}>
      <Card.Content>
        {error && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-4">
          {!pinMode ? (
            <>
              <TextField name="phone" type="phone">
                <Label className="ml-1">Phone</Label>
                <Description>Enter your phone number</Description>
                <InputGroup variant="secondary">
                  <InputGroup.Prefix>
                    <IconDeviceMobile width={16} />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    placeholder="+621234567890"
                    value={phone}
                    onChange={(e) =>
                      dispatch({ type: "SET_PHONE", payload: e.target.value })
                    }
                  />
                  <InputGroup.Suffix className="px-0.5">
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs rounded-xl"
                      onClick={handleOtp}
                      isDisabled={otpSent !== 0}
                    >
                      {otpSent === 0
                        ? "Send OTP"
                        : otpSent === 1
                          ? "Sending..."
                          : "OTP Sent!"}
                    </Button>
                  </InputGroup.Suffix>
                </InputGroup>
              </TextField>
              <TextField name="pin" type="number">
                <Label className="ml-1">OTP</Label>
                <Description>Enter a 6-digit OTP</Description>
                <InputOTP
                  variant="secondary"
                  maxLength={6}
                  value={otp}
                  onChange={(v) => dispatch({ type: "SET_OTP", payload: v })}
                >
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                  </InputOTP.Group>
                </InputOTP>
              </TextField>
            </>
          ) : (
            <TextField name="pin" type="number">
              <Label className="ml-1">PIN</Label>
              <Description>Create a 6-digit PIN</Description>
              <InputOTP
                variant="secondary"
                maxLength={6}
                value={pin}
                onChange={(v) => dispatch({ type: "SET_PIN", payload: v })}
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>
            </TextField>
          )}
        </div>
      </Card.Content>
      <Card.Footer className="mt-4 flex flex-col gap-2">
        <Button className="w-full" type="submit">
          {!pinMode ? "Next" : "Register"}
        </Button>
        {pinMode && (
          <Button className="w-full" variant="tertiary" onClick={handleSkipPin}>
            Skip and enter dashboard
          </Button>
        )}
        <Button
          className="w-full"
          variant="tertiary"
          onClick={() => setMode("login")}
        >
          Already have an account?
        </Button>
      </Card.Footer>
    </Form>
  );
};

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <>
      <PixelBlast
        className="fixed! inset-0 z-0 dark:opacity-50"
        color="#EAB308"
        pixelSize={4}
      />
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="mb-10 text-6xl font-semibold tracking-tight z-10 text-foreground">
          MDrive
        </h1>
        <Card className="w-full max-w-sm">
          <Card.Header className="my-4">
            <Card.Title className="text-center text-xl font-bold">
              {mode === "login" ? "Login" : "Register"}
            </Card.Title>
            <Card.Description className="text-center">
              {mode === "login"
                ? "Enter your credentials to access your account"
                : "Create a new account"}
            </Card.Description>
          </Card.Header>
          {mode === "login" ? (
            <LoginForm setMode={setMode} />
          ) : (
            <RegisterForm setMode={setMode} />
          )}
        </Card>
      </div>
    </>
  );
}
