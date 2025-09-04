export default function Divider({ label = "or" }: { label?: string }) {
    return (
      <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="uppercase tracking-wide">{label}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    );
  }
  