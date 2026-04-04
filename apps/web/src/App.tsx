import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { PanelProtegido } from "./features/panel/PanelProtegido";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<PanelProtegido />} />
    </Routes>
  );
}

export default App;
