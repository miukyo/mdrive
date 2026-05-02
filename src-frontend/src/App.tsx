import { useEffect } from "react";
import { Route } from "wouter";
import Auth from "./pages/Auth";
import { useAuthStore } from "./stores/Auth.store";
import Dashboard from "./pages/Dashboard";

function App() {
	const { init } = useAuthStore();

	useEffect(() => {
		init();
	}, [init]);

	return (
		<>
			<Route path="/">
				<Auth />
			</Route>
			<Route path="/drive" nest>
				<Dashboard />
			</Route>
		</>
	);
}

export default App;
