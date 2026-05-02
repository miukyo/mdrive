import {
	Button,
	Card,
	Description,
	Form,
	InputGroup,
	InputOTP,
	Label,
	Link,
	TextField,
} from "@heroui/react";
import { IconDeviceMobile } from "@tabler/icons-react";
import PixelBlast from "../components/PixelBackground";
import { useState } from "react";
import { useAuthStore } from "../stores/Auth.store";
import { useLocation } from "wouter";

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
		login(phone, pin).then((result) => {
			if (result.success) {
				// Success logic
			} else {
				setError(result.message || "An unknown error occurred");
			}
		});
	}
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
							<InputGroup.Input placeholder="+621234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
						</InputGroup>
					</TextField>
					<TextField name="otp" type="number">
						<Label className="ml-1">PIN</Label>
						<Description>Enter the 6-digit PIN</Description>
						<InputOTP variant="secondary" maxLength={6} value={pin} onChange={setPin}>
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

const RegisterForm = ({ setMode }: { setMode: setModeFunction }) => {
	const [pinMode, setPinMode] = useState(false);

	const [phone, setPhone] = useState("");
	const [pin, setPin] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const { register, sendOtp, setPin: setPinStore } = useAuthStore();

	const handleOtp = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		sendOtp(phone).then((result) => {
			if (result.success) {
				console.log('success')
			} else {
				setError(result.message || "Failed to send OTP");
			}
		});
	}
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!pinMode) {
			register(otp).then((result) => {
				if (result.success) {
					setPinMode(true);
				} else {
					setError(result.message || "Registration failed");
				}
			});
		} else {
			setPinStore(pin).then((result) => {
				if (result.success) {
					setMode("login");
				} else {
					setError(result.message || "Failed to set PIN");
				}
			});
		}
	}
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
									<InputGroup.Input placeholder="+621234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
									<InputGroup.Suffix className="px-0.5">
										<Button
											type="button"
											size="sm"
											className="text-xs rounded-xl"
											onClick={handleOtp}
										>
											Send OTP
										</Button>
									</InputGroup.Suffix>
								</InputGroup>
							</TextField>
							<TextField name="pin" type="number">
								<Label className="ml-1">OTP</Label>
								<Description>Enter a 6-digit OTP</Description>
								<InputOTP variant="secondary" maxLength={6} value={otp} onChange={setOtp}>
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
							<InputOTP variant="secondary" maxLength={6} value={pin} onChange={setPin}>
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
	const [_, navigate] = useLocation();
	const { sessionId } = useAuthStore();
	if (sessionId) {
		navigate("/drive");
	}
	return (
		<>
			<PixelBlast
				className="fixed! inset-0 z-0 dark:opacity-50"
				color="#EAB308"
				pixelSize={4}
			/>
			<div className="flex flex-col items-center justify-center h-screen">
				<h1 className="mb-10 text-6xl font-black tracking-tight z-10 text-foreground">
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
