export default function MessageText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
        part.startsWith("http") ? <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="underline">{part}</a> : part
      )}
    </p>
  );
}
