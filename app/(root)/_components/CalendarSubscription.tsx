"use client";

import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Check, Calendar } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { HiOutlineLink } from "react-icons/hi";
import { track } from "@vercel/analytics";

interface CalendarSubscriptionProps {
  googleCalendarUrl: string;
  icalUrl: string;
  inline?: boolean;
}

const CalendarSubscription: FC<CalendarSubscriptionProps> = ({
  googleCalendarUrl,
  icalUrl,
  inline = false,
}) => {
  const [copiedIcal, setCopiedIcal] = useState(false);

  const handleCopyIcal = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopiedIcal(true);
      setTimeout(() => setCopiedIcal(false), 2000);
      console.log("[Calendar Subscription] iCal URL copied to clipboard");
      track("calendar_subscription", {
        method: "ical_copy",
        url: icalUrl,
      });
    } catch (error) {
      console.error("[Calendar Subscription] Failed to copy iCal URL:", error);
    }
  };

  const handleGoogleCalendarClick = () => {
    console.log(
      "[Calendar Subscription] Opening Google Calendar subscription link",
    );
    track("calendar_subscription", {
      method: "google_calendar",
      url: googleCalendarUrl,
    });
    window.open(googleCalendarUrl, "_blank");
  };

  const dropdownButton = (
    <>
      {/* Mobile: Compact button with "Sync" */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="md:hidden">
            <Calendar className="w-4 h-4" />
            Sync
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleGoogleCalendarClick}>
            <FcGoogle className="w-4 h-4" />
            <div>
              <div>Google Calendar</div>
              <div className="text-xs text-muted-foreground">
                Subscribe with Google Calendar
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyIcal}>
            {copiedIcal ? (
              <Check className="w-4 h-4" />
            ) : (
              <HiOutlineLink className="w-4 h-4" />
            )}
            <div>
              <div>{copiedIcal ? "Copied!" : "Copy iCal Link"}</div>
              <div className="text-xs text-muted-foreground">
                Copy link for Apple Calendar, Outlook, etc.
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Desktop: Full button with text */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="hidden md:flex font-medium">
            <Calendar className="w-4 h-4" />
            Sync Calendar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleGoogleCalendarClick}>
            <FcGoogle className="w-4 h-4" />
            <div>
              <div>Google Calendar</div>
              <div className="text-xs text-muted-foreground">
                Subscribe with Google Calendar
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyIcal}>
            {copiedIcal ? (
              <Check className="w-4 h-4" />
            ) : (
              <HiOutlineLink className="w-4 h-4" />
            )}
            <div>
              <div>{copiedIcal ? "Copied!" : "Copy iCal Link"}</div>
              <div className="text-xs text-muted-foreground">
                Copy link for Apple Calendar, Outlook, etc.
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  if (inline) {
    return dropdownButton;
  }

  return (
    <Card className="w-full mb-4 bg-gradient-to-br from-blue-50/50 to-transparent border border-gray-200 shadow-none hover:shadow-sm transition-all duration-300 rounded-2xl @container">
      <CardContent className="px-4 py-3.5 @sm:px-5 @sm:py-4">
        <div className="flex flex-col @sm:flex-row @sm:items-center @sm:justify-between gap-3">
          {/* Content Section */}
          <div className="flex-1">
            <p className="text-sm @sm:text-base text-foreground font-medium">
              Add my upcoming classes to your calendar
            </p>
          </div>

          {/* Subscribe Button - Same for both mobile and desktop */}
          {dropdownButton}
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarSubscription;
