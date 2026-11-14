import { createRoot } from "react-dom/client";
import SelfhostPilotApp from "./SelfhostPilotApp";
import "./selfhostPilot.css";

const root = document.getElementById("root");
if (!root) throw new Error("Не найден элемент #root для тестового сервера.");
createRoot(root).render(<SelfhostPilotApp />);
