import { MarkdownEditor } from "./editor/MarkdownEditor";

function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900">
      <MarkdownEditor />
    </div>
  );
}

export default App;
