// Shown inside a window while its app chunk downloads (usually a few ms).
export default function AppLoading() {
  return (
    <div className="size-full flex-center">
      <div className="size-5 rounded-full border-2 border-gray-400/40 border-t-gray-500 animate-spin" />
    </div>
  );
}
