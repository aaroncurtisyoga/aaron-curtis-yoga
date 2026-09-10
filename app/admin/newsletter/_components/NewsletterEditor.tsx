"use client";

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Newsletter } from "@prisma/client";
import { Editor } from "@tiptap/react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  Eye,
  Loader2,
  Monitor,
  Save,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Tiptap from "@/app/_components/Tiptap";
import { EmojiPickerPopover } from "@/app/_components/Tiptap/EmojiPicker";
import { useNewsletterAutosave } from "@/app/_hooks/useNewsletterAutosave";
import {
  findNewsletterContentIssues,
  renderNewsletterHtml,
  resolveMergeTags,
} from "@/app/_lib/email/newsletter-template";
import {
  getNewsletterEventSectionsHtml,
  getSubscriberCount,
  sendNewsletter,
  sendTestNewsletter,
} from "@/app/_lib/actions/newsletter.actions";
import {
  NEWSLETTER_SCHEDULE_MAX_DAYS,
  NewsletterComposeSchema,
} from "@/app/_lib/schema";
import { formatDateTime } from "@/app/_lib/utils";
import InsertEventDialog from "@/app/admin/newsletter/_components/InsertEventDialog";
import {
  SNIPPETS,
  STARTER_TEMPLATE_HTML,
} from "@/app/admin/newsletter/_lib/templates";

type ComposeInputs = z.infer<typeof NewsletterComposeSchema>;

const LIVE_PREVIEW_KEY = "acy:newsletter:live-preview";
const PREVIEW_WIDTH_KEY = "acy:newsletter:preview-width";
const SUBJECT_MAX = 150;

interface NewsletterEditorProps {
  newsletter?: Newsletter;
}

const NewsletterEditor: FC<NewsletterEditorProps> = ({ newsletter }) => {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  // Live "Upcoming" + "Classes This Week" HTML, appended after the message.
  const [sectionsHtml, setSectionsHtml] = useState("");
  // Live-preview mode renders the email beside the editor as you type.
  const [livePreview, setLivePreview] = useState(true);
  // Shown in the Send dialog so "send to all subscribers" has a number on it.
  const [subscriberCount, setSubscriberCount] = useState<{
    count: number;
    hasMore: boolean;
  } | null>(null);
  // Distinguish "still loading" from "couldn't fetch" so the dialog can say
  // so instead of silently pretending nothing happened.
  const [countFailed, setCountFailed] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ComposeInputs>({
    resolver: zodResolver(NewsletterComposeSchema),
    defaultValues: {
      subject: newsletter?.subject ?? "",
      previewText: newsletter?.previewText ?? "",
      // A new newsletter opens with the greeting/sign-off skeleton instead of
      // a blank page.
      content: newsletter?.content ?? STARTER_TEMPLATE_HTML,
      includeUpcoming: newsletter?.includeUpcoming ?? true,
      includeClasses: newsletter?.includeClasses ?? true,
      includeDescriptions: newsletter?.includeDescriptions ?? false,
    },
  });

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // Draft persistence: debounced autosave, the one-save-at-a-time queue, the
  // create-then-swap-URL flow, and the unsaved-changes navigation guard.
  const {
    saveState,
    setSaveState,
    lastSavedAt,
    savedAgoLabel,
    isDraftValid,
    persistDraft,
    cancelPendingAutosave,
    releaseForNavigation,
  } = useNewsletterAutosave({
    newsletter,
    control,
    getValues,
    reset,
    isDirty,
    isSubmitting,
    isSending,
    onLeaveNavigate: () => router.replace("/admin/newsletter"),
  });

  const includeUpcoming = useWatch({ control, name: "includeUpcoming" });
  const includeClasses = useWatch({ control, name: "includeClasses" });
  const includeDescriptions = useWatch({
    control,
    name: "includeDescriptions",
  });
  const subjectValue = useWatch({ control, name: "subject" }) ?? "";
  const previewTextValue = useWatch({ control, name: "previewText" }) ?? "";

  // Pull the same listings that get appended at send time so Preview matches.
  useEffect(() => {
    let active = true;
    const loadSections = async () => {
      try {
        const html = await getNewsletterEventSectionsHtml({
          includeUpcoming,
          includeClasses,
          includeDescriptions,
        });
        if (active) setSectionsHtml(html);
      } catch {
        // Preview just omits the event sections until the next toggle change.
      }
    };
    loadSections();
    return () => {
      active = false;
    };
  }, [includeUpcoming, includeClasses, includeDescriptions]);

  // Restore the live-preview choice for this browser (defaults on).
  useEffect(() => {
    if (window.localStorage.getItem(LIVE_PREVIEW_KEY) === "false") {
      setLivePreview(false);
    }
    if (window.localStorage.getItem(PREVIEW_WIDTH_KEY) === "mobile") {
      setMobilePreview(true);
    }
  }, []);

  const toggleLivePreview = (next: boolean) => {
    setLivePreview(next);
    window.localStorage.setItem(LIVE_PREVIEW_KEY, String(next));
  };

  // Most subscribers read on phones, so previewing at ~375px catches
  // oversized images and cramped event cards before a test send would.
  const [mobilePreview, setMobilePreview] = useState(false);
  const toggleMobilePreview = (mobile: boolean) => {
    setMobilePreview(mobile);
    window.localStorage.setItem(
      PREVIEW_WIDTH_KEY,
      mobile ? "mobile" : "desktop",
    );
  };

  const previewWidthToggle = (
    <div
      className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Preview width"
    >
      <button
        type="button"
        onClick={() => toggleMobilePreview(false)}
        aria-pressed={!mobilePreview}
        title="Desktop width"
        className={`rounded px-2 py-1 transition-colors ${
          !mobilePreview
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => toggleMobilePreview(true)}
        aria-pressed={mobilePreview}
        title="Phone width (375px)"
        className={`rounded px-2 py-1 transition-colors ${
          mobilePreview
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Smartphone className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  // Watch the fields shown in the email and debounce them so the live preview
  // refreshes shortly after you pause typing rather than on every keystroke.
  const watchedContent = useWatch({ control, name: "content" });
  const [debounced, setDebounced] = useState({
    content: newsletter?.content ?? "",
    previewText: newsletter?.previewText ?? "",
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({
        content: watchedContent ?? "",
        previewText: previewTextValue,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedContent, previewTextValue]);

  // Pre-flight check shown in the Send dialog: template placeholders and
  // broken merge tags block the send (the server refuses them too); other
  // bracketed text is a "did you mean to leave this in?" warning.
  const contentIssues = useMemo(
    () =>
      isSendOpen
        ? findNewsletterContentIssues(getValues("content") ?? "")
        : { blockers: [], warnings: [] },
    // getValues is stable; re-check whenever the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSendOpen],
  );

  const livePreviewSrcDoc = useMemo(
    () =>
      livePreview
        ? renderNewsletterHtml({
            contentHtml: `${resolveMergeTags(
              debounced.content || "<p>Start writing…</p>",
            )}${sectionsHtml}`,
            previewText: debounced.previewText,
            unsubscribeUrl: "#",
          })
        : "",
    [livePreview, debounced, sectionsHtml],
  );

  // Fetch the audience size when the Send dialog opens.
  useEffect(() => {
    if (!isSendOpen) return undefined;
    let active = true;
    setSubscriberCount(null);
    setCountFailed(false);
    getSubscriberCount()
      .then((result) => {
        if (!active) return;
        if (result) {
          setSubscriberCount({ count: result.count, hasMore: result.hasMore });
        } else {
          setCountFailed(true);
        }
      })
      .catch(() => {
        // Dialog copy says the count is unavailable — no number, no crash.
        if (active) setCountFailed(true);
      });
    return () => {
      active = false;
    };
  }, [isSendOpen]);

  const onSaveDraft = async (data: ComposeInputs) => {
    cancelPendingAutosave();
    try {
      const { saved, message } = await persistDraft(data);
      if (!saved) {
        setSaveState("error");
        toast.error(message ?? "Failed to save the draft.");
        return;
      }
      toast.success("Draft saved");
    } catch {
      // A rejected server action (expired session, network drop) otherwise
      // fails with no feedback at all.
      setSaveState("error");
      toast.error("Couldn't reach the server — check your connection.");
    }
  };

  const handleSendTest = async () => {
    if (!(await trigger())) return;
    setIsTesting(true);
    try {
      const result = await sendTestNewsletter(getValues());
      if (result.status) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
    } finally {
      setIsTesting(false);
    }
  };

  const insertAtCursor = (html: string) => {
    editorRef.current?.chain().focus().insertContent(html).run();
  };

  const handleInsertGreeting = () => {
    // Resend swaps {{{contact.first_name}}} for each person's name at send
    // time — greetings belong at the very top, so insert at the start.
    editorRef.current
      ?.chain()
      .focus("start")
      .insertContent("<p>Hey {{{contact.first_name}}}</p>")
      .run();
  };

  // The calendar can only disable whole days, so a time later on the 30th day
  // still gets through it — this minute-level check drives the Schedule
  // button and inline error instead of a dead-end toast.
  const scheduleTooFar =
    !!scheduledAt &&
    scheduledAt.getTime() >
      Date.now() + NEWSLETTER_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000;

  const handleSend = async (when: "now" | "scheduled") => {
    if (when === "scheduled") {
      if (!scheduledAt) {
        toast.error("Pick a date and time first.");
        return;
      }
      if (scheduledAt <= new Date()) {
        toast.error("The scheduled time must be in the future.");
        return;
      }
      const maxSchedule = new Date(
        Date.now() + NEWSLETTER_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000,
      );
      if (scheduledAt > maxSchedule) {
        toast.error(
          `Resend can schedule up to ${NEWSLETTER_SCHEDULE_MAX_DAYS} days ahead — pick an earlier time.`,
        );
        return;
      }
    }

    cancelPendingAutosave();
    setIsSending(true);
    try {
      // The broadcast is built from the saved row (content and section
      // toggles), so persist edits first.
      const { saved, message } = await persistDraft(getValues());
      if (!saved) {
        toast.error(message ?? "Failed to save the draft.");
        return;
      }

      const result = await sendNewsletter(
        saved.id,
        when === "scheduled" ? scheduledAt!.toISOString() : undefined,
      );
      if (!result.status) {
        toast.error(result.message);
        return;
      }

      toast.success(
        when === "scheduled"
          ? `Scheduled for ${formatDateTime(scheduledAt!).dateTime}`
          : "Newsletter sent!",
      );
      // Consume the Back/Forward sentinel (if one is armed) by replacing it
      // rather than pushing a new entry over it, so we don't leave a duplicate
      // /{id} entry the user would have to Back past twice.
      if (releaseForNavigation()) {
        router.replace("/admin/newsletter");
      } else {
        router.push("/admin/newsletter");
      }
    } catch {
      toast.error(
        "Couldn't reach the server — nothing was sent. Check your connection and try again.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const previewHtml = () =>
    renderNewsletterHtml({
      // Resolve the greeting to its no-name form and append the same event
      // listings that get added at send time, so Preview matches the real email.
      contentHtml: `${resolveMergeTags(
        getValues("content") || "<p>Nothing here yet…</p>",
      )}${sectionsHtml}`,
      previewText: getValues("previewText"),
      unsubscribeUrl: "#",
    });

  const insertSubjectEmoji = (char: string) => {
    const input = subjectInputRef.current;
    const current = getValues("subject") ?? "";
    // A never-focused input reports selection 0/0 — "add an emoji to my
    // subject" means append in that case, not prepend.
    const hasCaret = input && document.activeElement === input;
    const start = (hasCaret ? input.selectionStart : null) ?? current.length;
    const end = (hasCaret ? input.selectionEnd : null) ?? current.length;
    setValue("subject", current.slice(0, start) + char + current.slice(end), {
      shouldDirty: true,
      shouldValidate: true,
    });
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const caret = start + char.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const subjectRegister = register("subject");

  const charCounter = (length: number) => (
    <p
      className={`text-right text-xs ${
        length > SUBJECT_MAX ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {length}/{SUBJECT_MAX}
    </p>
  );

  return (
    <form onSubmit={handleSubmit(onSaveDraft)} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          ) : saveState === "error" ? (
            <span className="text-destructive">
              Autosave failed — use Save draft
            </span>
          ) : isDirty && !isDraftValid ? (
            <span className="text-amber-600">
              Unsaved changes — autosave needs a valid subject and body
            </span>
          ) : isDirty ? (
            <>Unsaved changes…</>
          ) : saveState === "saved" && lastSavedAt ? (
            <>Saved · {savedAgoLabel}</>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="live-preview"
            className="text-sm text-muted-foreground"
          >
            Live preview
          </Label>
          <Switch
            id="live-preview"
            checked={livePreview}
            onCheckedChange={toggleLivePreview}
          />
        </div>
      </div>

      <div
        className={
          livePreview ? "grid gap-6 lg:grid-cols-2 lg:items-start" : undefined
        }
      >
        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-6">
            <FormField label="Subject" error={errors.subject?.message} required>
              <>
                <div className="flex gap-1.5">
                  <Input
                    {...subjectRegister}
                    ref={(el) => {
                      subjectRegister.ref(el);
                      subjectInputRef.current = el;
                    }}
                    placeholder="e.g. July classes + a new workshop"
                    disabled={isSubmitting || isSending}
                    className="flex-1"
                  />
                  <EmojiPickerPopover
                    onSelect={insertSubjectEmoji}
                    disabled={isSubmitting || isSending}
                    onCloseAutoFocus={(e) => {
                      e.preventDefault();
                      subjectInputRef.current?.focus();
                    }}
                  />
                </div>
                {charCounter(subjectValue.length)}
              </>
            </FormField>

            <FormField label="Preview text" error={errors.previewText?.message}>
              <>
                <Input
                  {...register("previewText")}
                  placeholder="Shown next to the subject in inboxes (optional)"
                  disabled={isSubmitting || isSending}
                />
                {charCounter(previewTextValue.length)}
              </>
            </FormField>

            <FormField label="Body" error={errors.content?.message} required>
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <Tiptap
                    initialContent={field.value}
                    onChange={field.onChange}
                    onEditorReady={handleEditorReady}
                    placeholder="Write your newsletter…"
                    isDisabled={isSubmitting || isSending}
                    errorMessage={errors.content?.message}
                    showCharacterCount={false}
                    enableImages
                  />
                )}
              />
            </FormField>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Insert
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={handleInsertGreeting}>
                        Greeting (&ldquo;Hey [first name]&rdquo;)
                      </DropdownMenuItem>
                      {SNIPPETS.filter((s) => s.label !== "Greeting").map(
                        (snippet) => (
                          <DropdownMenuItem
                            key={snippet.label}
                            onSelect={() => insertAtCursor(snippet.html)}
                          >
                            {snippet.label}
                          </DropdownMenuItem>
                        ),
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setIsEventDialogOpen(true)}
                      >
                        <CalendarPlus className="w-4 h-4" /> Event card…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: the greeting uses{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                    {"{{{contact.first_name}}}"}
                  </code>
                  , so people with a name see “Hey Aaron” and everyone else sees
                  “Hey.”
                </p>
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Add below your message
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-upcoming"
                      checked={includeUpcoming}
                      onCheckedChange={(checked) =>
                        setValue("includeUpcoming", checked, {
                          shouldDirty: true,
                        })
                      }
                      disabled={isSending}
                    />
                    <Label
                      htmlFor="include-upcoming"
                      className="text-sm font-normal text-foreground"
                    >
                      Upcoming events
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-classes"
                      checked={includeClasses}
                      onCheckedChange={(checked) =>
                        setValue("includeClasses", checked, {
                          shouldDirty: true,
                        })
                      }
                      disabled={isSending}
                    />
                    <Label
                      htmlFor="include-classes"
                      className="text-sm font-normal text-foreground"
                    >
                      Classes this week
                    </Label>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    id="include-descriptions"
                    checked={includeDescriptions}
                    onCheckedChange={(checked) =>
                      setValue("includeDescriptions", checked, {
                        shouldDirty: true,
                      })
                    }
                    disabled={isSending || !includeUpcoming}
                  />
                  <Label
                    htmlFor="include-descriptions"
                    className={`text-sm font-normal ${
                      includeUpcoming
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Include event descriptions
                  </Label>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground">
                  Turn off “Classes this week” to focus a send on just an
                  upcoming event. Empty sections are skipped automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {livePreview && (
          <div className="lg:sticky lg:top-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live preview
              </p>
              {previewWidthToggle}
            </div>
            <iframe
              title="Live newsletter preview"
              srcDoc={livePreviewSrcDoc}
              sandbox=""
              className={`h-[70vh] rounded-md border bg-white shadow-lg lg:h-[78vh] ${
                mobilePreview ? "mx-auto block w-[375px] max-w-full" : "w-full"
              }`}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {!livePreview && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(true)}
            >
              <Eye className="w-4 h-4" /> Preview
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isTesting}
            onClick={handleSendTest}
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send test to me
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="secondary"
            disabled={isSubmitting || isSending}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save draft
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || isSending}
            onClick={async () => {
              if (await trigger()) setIsSendOpen(true);
            }}
          >
            <Send className="w-4 h-4" /> Send…
          </Button>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>
              How the email will look in most clients.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">{previewWidthToggle}</div>
          {isPreviewOpen && (
            <iframe
              title="Newsletter preview"
              srcDoc={previewHtml()}
              className={`h-[60vh] rounded-md border bg-white ${
                mobilePreview ? "mx-auto block w-[375px] max-w-full" : "w-full"
              }`}
              sandbox=""
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send newsletter</DialogTitle>
            <DialogDescription>
              {subscriberCount !== null ? (
                <>
                  Sends to{" "}
                  <strong>
                    {subscriberCount.count}
                    {subscriberCount.hasMore ? "+" : ""}
                  </strong>{" "}
                  {subscriberCount.count === 1 && !subscriberCount.hasMore
                    ? "subscriber"
                    : "subscribers"}{" "}
                  now, or pick a time.
                </>
              ) : countFailed ? (
                "Couldn't fetch the subscriber count — it will still send to all subscribers."
              ) : (
                "Send to all subscribers now, or pick a time."
              )}{" "}
              Scheduled sends can be cancelled from the newsletters list until
              they go out.
            </DialogDescription>
          </DialogHeader>

          {/* Last-glance check on what's being sent, not just who gets it. */}
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="truncate text-sm font-medium">{subjectValue}</p>
            {previewTextValue ? (
              <p className="truncate text-xs text-muted-foreground">
                {previewTextValue}
              </p>
            ) : null}
          </div>

          {contentIssues.blockers.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">Fix before sending:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {contentIssues.blockers.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {contentIssues.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">Double-check:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {contentIssues.warnings.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <DateTimePicker
            label="Schedule for later (optional)"
            value={scheduledAt}
            onChange={setScheduledAt}
            minDate={new Date()}
            maxDate={
              // Resend's broadcast scheduling window.
              new Date(
                Date.now() + NEWSLETTER_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000,
              )
            }
            placeholder="Pick a date and time"
            error={
              scheduleTooFar
                ? `Resend can schedule up to ${NEWSLETTER_SCHEDULE_MAX_DAYS} days ahead — pick an earlier time.`
                : undefined
            }
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={
                isSending ||
                !scheduledAt ||
                scheduleTooFar ||
                contentIssues.blockers.length > 0
              }
              onClick={() => handleSend("scheduled")}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarClock className="w-4 h-4" />
              )}
              Schedule
            </Button>
            <Button
              type="button"
              disabled={isSending || contentIssues.blockers.length > 0}
              onClick={() => handleSend("now")}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InsertEventDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        onInsert={insertAtCursor}
      />
    </form>
  );
};

export default NewsletterEditor;
