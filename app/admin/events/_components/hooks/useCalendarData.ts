import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  getEventsByMonth,
  deleteEvent,
} from "@/app/_lib/actions/event.actions";
import type { EventWithLocationAndCategory } from "@/app/_lib/types";
import type { EventTableFilters } from "./useEventTableFilters";

export function useCalendarData(filters: Omit<EventTableFilters, "page">) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<EventWithLocationAndCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { searchText, category, statusFilter } = filters;

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const data = await getEventsByMonth({
          year,
          month,
          query: searchText || undefined,
          category: category || undefined,
          isActive:
            statusFilter === "all" ? undefined : statusFilter === "active",
        });
        setEvents(data);
      } catch (error) {
        console.error("Failed to fetch calendar events", error);
        toast.error("Failed to fetch events.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [year, month, searchText, category, statusFilter, refreshTrigger]);

  const goToPrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const handleDeleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      const response = await deleteEvent(eventId);
      if (response.success) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        toast.success("Event deleted successfully");
        return true;
      }
      throw new Error("Failed to delete event");
    } catch (error) {
      console.error("Failed to delete event", error);
      toast.error("Failed to delete event. Please try again.");
      return false;
    }
  };

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithLocationAndCategory[]>();
    for (const event of events) {
      const dateKey = new Date(event.startDateTime).toLocaleDateString(
        "en-CA",
        { timeZone: "America/New_York" },
      );
      const existing = map.get(dateKey) || [];
      existing.push(event);
      map.set(dateKey, existing);
    }
    return map;
  }, [events]);

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    year,
    month,
    events,
    loading,
    eventsByDate,
    monthLabel,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    handleDeleteEvent,
    refreshEvents: () => setRefreshTrigger((prev) => prev + 1),
  };
}
