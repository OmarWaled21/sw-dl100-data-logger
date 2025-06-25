function updateLastUpdates() {
    const elements = document.querySelectorAll(".last-update");
    elements.forEach(el => {
        const originalText = el.textContent.trim();
        const fullDateTime = new Date(originalText);

        if (!isNaN(fullDateTime)) {
            const today = new Date();
            const isSameDay = fullDateTime.toDateString() === today.toDateString();

            let hours = fullDateTime.getHours();
            const minutes = fullDateTime.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;

            if (isSameDay) {
                el.textContent = `Last Update: ${hours}:${minutes} ${ampm}`;
            } else {
                el.textContent = `Last Update: ${fullDateTime.toLocaleDateString()}`;
            }
        } else {
            el.textContent = "Last Update: --:--";
        }
    });
}
