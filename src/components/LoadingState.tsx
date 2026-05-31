type LoadingStateProps = {
  message?: string;
  submessage?: string;
};

export function LoadingState({
  message = "Loading…",
  submessage,
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      <div>
        <p className="text-lg font-medium text-zinc-800">{message}</p>
        {submessage && (
          <p className="mt-1 text-sm text-zinc-500">{submessage}</p>
        )}
      </div>
    </div>
  );
}
