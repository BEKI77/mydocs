import { DOCUMENT_TYPES, type DocumentType } from "@dw/types";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { ACCEPTED_TYPES, addDocument, MAX_UPLOAD_BYTES } from "../services/verification";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Rotates an image 90° clockwise by redrawing it; the result is re-encoded as JPEG. */
async function rotateImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not rotate the image"))), "image/jpeg", 0.92),
  );
}

export default function Scan() {
  const navigate = useNavigate();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [type, setType] = useState<DocumentType>("NATIONAL_ID");
  const [documentNumber, setDocumentNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isImage = file?.type.startsWith("image/") ?? false;

  useEffect(() => {
    if (!file || !isImage) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (!ACCEPTED_TYPES.includes(picked.type)) return setError("Choose a JPEG, PNG or PDF file.");
    if (picked.size > MAX_UPLOAD_BYTES) return setError("That file is larger than 10 MB. Choose a smaller one.");
    setError(null);
    setFile(picked);
    setFileName(picked.name);
  }

  async function rotate() {
    if (!file) return;
    try {
      setFile(await rotateImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError("Scan or upload your document first.");
    setBusy(true);
    setError(null);
    try {
      const id = await addDocument({ file, type, documentNumber, name, description });
      navigate(`/documents/${id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={submit}>
      <Header title="Add document" backTo="/wallet" backLabel="Back to wallet" />

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={fileInput} type="file" accept={ACCEPTED_TYPES.join(",")} hidden onChange={pick} />
      <div className="source-grid">
        <button type="button" className="source source-dark" onClick={() => cameraInput.current?.click()}>
          <span className="mint"><Icon name="camera" size={26} stroke={1.8} /></span>
          <span><span className="source-title">Scan document</span><span className="small">Use the camera</span></span>
        </button>
        <button type="button" className="source" onClick={() => fileInput.current?.click()}>
          <span className="accent"><Icon name="upload" size={26} stroke={1.8} /></span>
          <span><span className="source-title">Upload file</span><span className="small muted">PDF, JPEG or PNG</span></span>
        </button>
      </div>

      {file && (
        <div className="attachment">
          {previewUrl ? <img src={previewUrl} alt="Preview of your document" /> : <span className="attachment-icon"><Icon name="document" /></span>}
          <span className="attachment-text">
            <span className="strong">{isImage ? "Scan captured" : "File attached"}</span>
            <span className="muted small">{fileName || "Document"} · {formatSize(file.size)}</span>
          </span>
          {isImage && <button type="button" className="text-button" onClick={rotate}>Rotate</button>}
        </div>
      )}

      <div className="stack">
        <div className="field">
          <label htmlFor="doc-type">Document type</label>
          <select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {Object.entries(DOCUMENT_TYPES).map(([code, t]) => <option key={code} value={code}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-number">Document number</label>
          <input id="doc-number" type="text" className="mono" required maxLength={64} autoCapitalize="characters" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="doc-name">Name on document</label>
          <input id="doc-name" type="text" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="doc-desc">Description <span className="muted">(optional)</span></label>
          <input id="doc-desc" type="text" maxLength={500} placeholder="Add a note for the issuer" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="spacer" />
      <button type="submit" className="button button-primary" disabled={busy}>
        {busy ? "Submitting…" : "Submit for verification"}
      </button>
    </form>
  );
}
