import { Event } from "@/types";

export const generateGoogleCalendarUrl = (event: Event): string => {
    const startDate = event.startDate.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "");
    // Default 1 hour if no end date
    const endDate = event.endDate
        ? event.endDate.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "")
        : new Date(event.startDate.toDate().getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${startDate}/${endDate}`,
        details: event.description || '',
        location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const downloadIcsFile = (event: Event) => {
    const startDate = event.startDate.toDate();
    const endDate = event.endDate
        ? event.endDate.toDate()
        : new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Bethel Social//Church Calendar//EN',
        'BEGIN:VEVENT',
        `UID:${event.id}@bethel.social`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
        `LOCATION:${event.location || ''}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
