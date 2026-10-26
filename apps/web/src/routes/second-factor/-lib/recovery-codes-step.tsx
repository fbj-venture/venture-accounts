import { Button } from "#/components/ui/button.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import { Label } from "#/components/ui/label.tsx"
import { CopyIcon, DownloadIcon } from "lucide-react"
import { useState } from "react"

// Shows the recovery codes - the only time they can be seen - and won't let
// the user carry on until they say they've saved them.
export function RecoveryCodesStep({
  codes,
  email,
  busy,
  onContinue,
}: {
  codes: string[]
  email: string
  busy: boolean
  onContinue: () => void
}) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = codes.join("\n")

  function download() {
    const file = [
      "Venture Accounts recovery codes",
      `Account: ${email}`,
      `Created: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "Each code works once, in place of your passkey. Keep them somewhere safe.",
      "",
      text,
      "",
    ].join("\n")
    const url = URL.createObjectURL(new Blob([file], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "venture-accounts-recovery-codes.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid gap-4 text-sm">
      <p>
        If you lose your passkey, each of these one-time codes lets you sign in once. They won't be
        shown again - download or copy them now and keep them somewhere safe.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-base">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={download}>
          <DownloadIcon /> Download
        </Button>
        <Button type="button" variant="outline" onClick={copy}>
          <CopyIcon /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="codes-saved"
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <Label htmlFor="codes-saved">I've saved these recovery codes somewhere safe</Label>
      </div>
      <Button type="button" disabled={!saved || busy} onClick={onContinue}>
        {busy ? "Finishing..." : "Finish and continue"}
      </Button>
    </div>
  )
}
