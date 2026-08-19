// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Wait until the entire HTML page is loaded before running our script
document.addEventListener('DOMContentLoaded', async () => {

    // --- FIREBASE CONFIGURATION ---
    // REPLACE THE VALUES BELOW WITH YOUR EXACT FIREBASE CONFIG
    const firebaseConfig = {
        apiKey: "AIzaSyCQ2IOoNAGEYWJMN4iB1j1cgg199MLqCnU",
        authDomain: "magic-notebook-project.firebaseapp.com",
        projectId: "magic-notebook-project",
        storageBucket: "magic-notebook-project.firebasestorage.app",
        messagingSenderId: "279845274939",
        appId: "1:279845274939:web:a7cfa6e916b7e5ca5d631e"
    };

    // --- INITIALIZE FIREBASE ---
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const accordionContainer = document.getElementById('accordion-container');
    const yearSpan = document.getElementById('current-year');

    // --- Function 1: Set the current year in the footer ---
    const updateYear = () => {
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
    };


    // --- Function 2: Convert WhatsApp formatting to HTML for display ---
    // This makes the text look good inside the app.
    const formatContentForDisplay = (content) => {
        // Regex to find YouTube links, including standard, shorts, and youtu.be formats
        const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s<]+)/g;

        // Regex to find other links (that are NOT YouTube links)
        const otherLinkRegex = /(https?:\/\/(?!.*(?:youtube\.com|youtu\.be))[^\s<]+)/g;

        return content
            // Bold and Italic: _*...*_ -> <h3>...</h3>
            .replace(/_\*(.*?)\*_/g, '<h3>$1</h3>')
            // Bold: *...* -> <strong>...</strong>
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            // Italic: _..._ -> <em>...</em>
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // First, process and style YouTube links
            .replace(youtubeRegex, '<a href="$1" target="_blank" class="youtube-link"><i class="fab fa-youtube"></i> Watch Training Video <i class="fas fa-external-link-alt"></i></a>')
            // Then, process any other links normally
            .replace(otherLinkRegex, '<a href="$1" target="_blank">$1</a>')
            // Line breaks: \n -> <br>
            .replace(/\n/g, '<br>');
    };

    // --- Function 3: Fetch and display instructions (UPDATED for Favorites) ---
    const loadInstructions = async () => {
        try {
            const response = await fetch('instructions.json');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            const instructions = data.instructions;

            // Run the new function to set up the scrolling notice
            setupScrollingNotice(data.scrolling_notice);

            // --- NEW: Setup Page Tracking ---
            setupPageTracking(data.system_settings);

            // --- START: Dynamic Referral ID Replacement ---
            const urlParams = new URLSearchParams(window.location.search);
            const refId = urlParams.get('refid');

            if (refId) {
                instructions.forEach(item => {
                    item.content = item.content.replace(/TYPE-YOUR-REFERRAL-ID-HERE/g, refId);
                });
            } else {
                instructions.forEach(item => {
                    item.content = item.content.replace(/TYPE-YOUR-REFERRAL-ID-HERE/g, 'TYPE-YOUR-REFERRAL-ID-HERE');
                });
            }
            // --- END: Dynamic Referral ID Replacement ---

            const accordionContainer = document.getElementById('accordion-container');
            accordionContainer.innerHTML = '';

            instructions.forEach((item, index) => {
                const itemElement = document.createElement('div');
                itemElement.classList.add('accordion-item');
                // Add the ID for deep linking AND sorting
                itemElement.dataset.guideIndex = index + 1;

                const displayContent = formatContentForDisplay(item.content);
                const contentInnerDivId = `content-inner-${index}`;

                // --- NEW: HTML Structure with Star Icon ---
                itemElement.innerHTML = `
                    <div class="accordion-header">
                        <div class="accordion-number">${index + 1}</div>
                        <button class="favorite-btn" title="Pin to Favorites" data-index="${index + 1}">
                            <i class="far fa-star"></i>
                        </button>
                        <h2>${item.title}</h2>
                        <i class="icon fas fa-chevron-down"></i>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-content-inner" id="${contentInnerDivId}">
                            ${displayContent}
                        </div>
                    </div>
                `;

                accordionContainer.appendChild(itemElement);

                if (item.form) {
                    const contentContainer = itemElement.querySelector(`#${contentInnerDivId}`);
                    buildAndAppendForm(item.form, contentContainer);
                    initializeFormInteractivity(item.form);
                } else {
                    const contentContainer = itemElement.querySelector(`#${contentInnerDivId}`);
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.innerHTML = '<i class="fas fa-copy"></i> <span>Copy for WhatsApp</span>';
                    contentContainer.appendChild(copyButton);

                    copyButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(item.content).then(() => {
                            const buttonText = copyButton.querySelector('span');
                            buttonText.textContent = 'Copied!';
                            copyButton.classList.add('copied');

                            setTimeout(() => {
                                buttonText.textContent = 'Copy for WhatsApp';
                                copyButton.classList.remove('copied');
                            }, 2000);
                        });
                    });
                }
            });

            // --- NEW: Initialize the Favorites System Logic ---
            setupFavoritesSystem();

            // --- NEW: Add Search Logic (Moved here) ---
            setupSearchLogic(instructions);

        } catch (error) {
            document.getElementById('accordion-container').innerHTML = '<p style="color: red;">Failed to load instructions.</p>';
            console.error(error);
        }
    };

    // --- Function 4: Handle accordion open/close logic (UPDATED) ---
    // We create a single handler function
    const handleAccordionClick = (e) => {
        // Check if the click was on a Favorite Star Button
        if (e.target.closest('.favorite-btn')) {
            return; // Let the specific favorite button listener handle it
        }

        const header = e.target.closest('.accordion-header');
        if (header) {
            const item = header.parentElement;

            // If the item is already active, we don't want to close others
            const isAlreadyActive = item.classList.contains('active');

            // Close all items in BOTH containers
            document.querySelectorAll('.accordion-item').forEach(el => {
                el.classList.remove('active');
                // Reset max-height
                const content = el.querySelector('.accordion-content');
                if (content) content.style.maxHeight = '0';
            });

            if (!isAlreadyActive) {
                item.classList.add('active');
                // Open the specific content
                const content = item.querySelector('.accordion-content');
                if (content) content.style.maxHeight = content.scrollHeight + "px";
            }
        }
    };

    // Attach the handler to BOTH containers
    document.getElementById('accordion-container').addEventListener('click', handleAccordionClick);
    document.getElementById('favorites-container').addEventListener('click', handleAccordionClick);

    // --- Function 5: Animate the main video hub button text ---
    const setupRotatingButtonText = () => {
        const buttonTextSpan = document.querySelector('.video-hub-link span');

        // Safety check: if the button doesn't exist, do nothing.
        if (!buttonTextSpan) {
            return;
        }

        const texts = [
            "Explore the TGR Video Training Hub",
            "Click to See More TGR Videos",
            "Watch More TGR Videos",
            "Click to Learn More"
        ];
        let currentIndex = 0;

        // Set an interval to run the code every 10 seconds (10000 milliseconds)
        setInterval(() => {
            // 1. Fade the text out
            buttonTextSpan.style.opacity = '0';

            // 2. Wait for the fade-out transition to finish (500ms)
            setTimeout(() => {
                // 3. Change the index to the next text in the array
                currentIndex = (currentIndex + 1) % texts.length;

                // 4. Update the text content
                buttonTextSpan.textContent = texts[currentIndex];

                // 5. Fade the new text back in
                buttonTextSpan.style.opacity = '1';
            }, 500); // This delay must match the CSS transition duration

        }, 10000); // 10-second interval
    };

    // --- Function 6: Handle "Back to Top" button ---
    const setupBackToTopButton = () => {
        const backToTopBtn = document.getElementById('back-to-top-btn');

        if (!backToTopBtn) return;

        // Show or hide the button based on scroll position
        window.addEventListener('scroll', () => {
            // Show the button if user has scrolled down more than 300px
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        // Scroll to the top when the button is clicked
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // For a smooth scrolling animation
            });
        });
    };


    // --- Function 7: Setup the scrolling notice bar ---
    const setupScrollingNotice = (noticeData) => {
        // If the feature is disabled or data is missing, do nothing.
        if (!noticeData || !noticeData.enabled) {
            return;
        }

        const marqueeContainer = document.getElementById('marquee-container');
        let content = noticeData.content;

        // Find and replace [tel:...] placeholders
        content = content.replace(/\[tel:([\d\s+-]+)\]/g, '<a href="tel:$1" class="marquee-link tel-link">$1</a>');

        // Find and replace [link:...|...] placeholders
        content = content.replace(/\[link:(.*?)\|(.*?)\]/g, '<a href="$1" target="_blank" class="marquee-link web-link">$2</a>');

        // Create the main marquee bar
        const marqueeBar = document.createElement('div');
        marqueeBar.className = 'marquee-bar';

        // Create the inner content wrapper that will be animated
        const marqueeContent = document.createElement('div');
        marqueeContent.className = 'marquee-content';

        // Create TWO identical blocks of content for the seamless loop
        const contentBlock1 = document.createElement('div');
        contentBlock1.className = 'marquee-content-block';
        contentBlock1.innerHTML = content;

        const contentBlock2 = document.createElement('div');
        contentBlock2.className = 'marquee-content-block';
        contentBlock2.innerHTML = content;

        marqueeContent.appendChild(contentBlock1);
        marqueeContent.appendChild(contentBlock2);
        marqueeBar.appendChild(marqueeContent);
        marqueeContainer.appendChild(marqueeBar);

        // --- START: New Dynamic Speed Calculation ---
        // Define our desired speed in pixels per second. You can adjust this value.
        const PIXELS_PER_SECOND = 60;

        // Measure the actual width of one of the content blocks
        const contentWidth = contentBlock1.offsetWidth;

        // Calculate the required animation duration to maintain the desired speed
        // Duration (seconds) = Distance (pixels) / Speed (pixels per second)
        const duration = contentWidth / PIXELS_PER_SECOND;

        // Apply the dynamically calculated duration directly to the element's style
        marqueeContent.style.animationDuration = `${duration}s`;
        // --- END: New Dynamic Speed Calculation ---
    };


    // --- START: Form Generation Logic ---

    // NEW HELPER FUNCTION TO CONVERT A STRING TO TITLE CASE
    const toTitleCase = (str) => {
        if (!str) return '';
        // This regex finds the first character of every word (including after a hyphen or apostrophe)
        // and capitalizes it, after making the whole string lowercase first.
        return str.toLowerCase().replace(/(?:^|\s|-|')\S/g, (char) => char.toUpperCase());
    };

    // Main function to build and append a form inside a guide
    const buildAndAppendForm = (formJson, container) => {
        const formWrapper = document.createElement('div');
        formWrapper.className = 'form-in-guide';
        formWrapper.id = formJson.id;

        // --- START: CRITICAL FIX ---
        // First, check if this form has input fields. If not, it's a toolkit,
        // which is handled by a different function, so we can stop here.
        if (!formJson.fields) {
            container.appendChild(formWrapper); // Still add the main wrapper for the toolkit to use
            return;
        }
        // --- END: CRITICAL FIX ---

        // Build each field
        formJson.fields.forEach(field => {
            const fieldGroup = document.createElement('div');
            fieldGroup.className = 'form-group';

            const label = document.createElement('label');
            label.htmlFor = field.id;
            label.textContent = field.label;
            fieldGroup.appendChild(label);

            if (field.type === 'select') {
                const select = document.createElement('select');
                select.id = field.id;
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.text;
                    select.appendChild(option);
                });
                fieldGroup.appendChild(select);
            } else { // Handles 'text', 'number', etc.
                const input = document.createElement('input');
                input.type = field.type;
                input.id = field.id;
                input.placeholder = field.placeholder || '';
                fieldGroup.appendChild(input);
            }
            formWrapper.appendChild(fieldGroup);
        });

        // Build the action button
        const button = document.createElement('button');
        button.id = formJson.button.id;
        button.className = 'form-action-btn';
        button.textContent = formJson.button.text;
        formWrapper.appendChild(button);

        // Build the result area
        const resultWrapper = document.createElement('div');
        resultWrapper.className = 'form-result-wrapper';
        if (formJson.result.type === 'textarea') {
            const textarea = document.createElement('textarea');
            textarea.id = formJson.result.id;
            textarea.readOnly = true;
            resultWrapper.appendChild(textarea);
        }
        formWrapper.appendChild(resultWrapper);

        container.appendChild(formWrapper);

        // After building, set up the interactivity
        //initializeFormInteractivity(formJson);
    };

    // This function acts as a "router" for all form logic
    const initializeFormInteractivity = (formJson) => {
        // SPECIAL CASE: For toolkits that need immediate setup, not a button click.
        if (formJson.calculation_logic === 'setupRegistrationToolkit') {
            setupRegistrationToolkit(formJson);
            return; // Stop here for this type of form
        }

        // Default behavior for calculator-style forms
        const button = document.getElementById(formJson.button.id);
        if (!button) return;

        button.addEventListener('click', () => {
            switch (formJson.calculation_logic) {
                case 'generateWelcomeMessage':
                    generateWelcomeMessage(formJson);
                    break;
                case 'calculateFantasticEarnings':
                    calculateFantasticEarnings(formJson);
                    break;
                // Add other 'case' statements here for future forms
            }
        });

        // --- NEW ADDITION ---
        // If this is the Welcome Message form, set up the extra UI logic
        if (formJson.calculation_logic === 'generateWelcomeMessage') {
            setupWelcomeMessageUI(formJson);
        }
    };

    // NEW: Sets up the dynamic UI changes for the Welcome/Upgrade form
    const setupWelcomeMessageUI = (formJson) => {
        const messageTypeSelect = document.getElementById('messageType');
        const packageLabel = document.querySelector(`label[for="packageType"]`);
        const generateBtn = document.getElementById(formJson.button.id);

        if (!messageTypeSelect || !packageLabel || !generateBtn) return;

        // Listen for changes on the "Message Type" dropdown
        messageTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'upgrade') {
                // Switch to Upgrade Mode
                packageLabel.textContent = "Upgrade Package:";
                generateBtn.textContent = "Generate Congrats Message";
            } else {
                // Switch back to Registration Mode
                packageLabel.textContent = "Registration Package:";
                generateBtn.textContent = "Generate Welcome Message";
            }
        });
    };

    // The specific logic for our Welcome/Upgrade Message Generator
    const generateWelcomeMessage = (formJson) => {
        // 1. Get the input elements
        const messageTypeInput = document.getElementById('messageType');
        const nameInput = document.getElementById('newMemberName');
        const usernameInput = document.getElementById('newMemberUsername');
        const packageSelect = document.getElementById('packageType');
        const resultTextarea = document.getElementById(formJson.result.id);
        const resultWrapper = resultTextarea.parentElement;
        const generateBtn = document.getElementById(formJson.button.id);

        // Get values and trim whitespace
        const messageType = messageTypeInput.value;
        const trimmedName = nameInput.value.trim();
        const trimmedUsername = usernameInput.value.trim();

        // Simple validation
        if (!trimmedName || !trimmedUsername) {
            alert('Please fill in both the name and username.');
            return;
        }

        // Button Feedback
        const originalButtonText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Generated!';
        generateBtn.classList.add('generated');

        // Process values
        const name = toTitleCase(trimmedName);
        const username = trimmedUsername;
        const selectedPackageText = packageSelect.options[packageSelect.selectedIndex].text;

        let message = "";

        if (messageType === 'upgrade') {
            // --- UPGRADE TEMPLATE ---
            // We convert package text to Uppercase for the upgrade message style
            const upperPackageText = selectedPackageText.toUpperCase();

            message = `🎉🎉🎉 *BOOM‼️ BOOM‼️ BOOM*‼️ 🎉🎉🎉

My dear *TGR FAMILY*, please join me in *CONGRATULATING* one of our shining stars 🌟

👨‍🚀 *${name}*
🔑 *Username:* *${username}* 🚀

…on the successful *UPGRADE* from a previous package to the prestigious
*${upperPackageText}*

🎊🎊 This *upgrade* means *more levels*, *more leverage*, and *more earning power*!
Welcome to a *DEEPER OIL WELL* in the *TELECOMS SECTOR* 🛢️📲💰

May this *bold move* unlock *MASSIVE COMMISSIONS*, *LEADERSHIP BONUSES*, and *NEXT-LEVEL SUCCESS*! 💸🔥🚀

💃🏽🕺🏽💰📞📲🛢️💎🥳`;

        } else {
            // --- REGISTRATION TEMPLATE (Original) ---

            // NEW: Create URL-safe name (replace spaces with underscores)
            const urlSafeName = name.replace(/\s+/g, '_');

            // UPDATED: Link now includes fullname and refid
            const playbookLink = `https://tgr-playbook.dammieoptimus.workers.dev/?fullname=${urlSafeName}&refid=${username}`;

            message = `🎉🎉🎉 *BOOM‼️BOOM BOOM* 🎉🎉🎉

My dear TGR family, please help me give a grand welcome to our newest superstar 🌟  

👨‍🚀 *${name}*  
🔑 *Username:* *${username}* 🚀  

...who just joined *TGR* with the *${selectedPackageText}*  

🎊🎊 You're officially WELCOME to your *Telecoms Sector Oil Well* 🛢️📲💰  
May this journey bring you *massive earnings* and *unstoppable success*! 💸🔥

💃🏽🕺🏽💰📞📲🛢️💎🥳


📘 *_All the Information You Need to Use TGR is Here_*  
👇🏽👇🏽👇🏽👇🏽  

🔗 ${playbookLink} ✅  

_Everything you need — guides, videos, and tools — all in one place!_ 💡📲`;
        }

        // Display the message
        resultTextarea.value = message;
        resultWrapper.style.display = 'block';

        // Recalculate accordion height
        const accordionContent = resultWrapper.closest('.accordion-content');
        if (accordionContent) {
            resultTextarea.style.height = 'auto';
            resultTextarea.style.height = (resultTextarea.scrollHeight) + 'px';
            accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
        }

        // Setup Copy Button
        if (!resultWrapper.querySelector('.copy-generated-text-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-generated-text-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Message';
            resultWrapper.appendChild(copyBtn);

            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(message).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Message';
                    }, 2000);
                });
            });
        }

        // Reset button
        setTimeout(() => {
            generateBtn.innerHTML = originalButtonText;
            generateBtn.classList.remove('generated');
        }, 2000);
    };


    // --- Function 8: Handle deeplinking to a specific guide (Index OR Topic) ---
    const handleDeeplinking = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const guideNumber = urlParams.get('guide');
        const guideTopic = urlParams.get('topic'); // NEW: Support text search

        let targetGuide = null;

        // Strategy 1: Look for a specific number (Legacy support)
        if (guideNumber) {
            targetGuide = document.querySelector(`[data-guide-index="${guideNumber}"]`);
        }
        // Strategy 2: Look for a topic string (Robust support)
        else if (guideTopic) {
            // Convert "how_to_register" or "how-to-register" -> "how to register"
            const searchTerm = guideTopic.replace(/[_-]/g, ' ').toLowerCase();

            // Loop through all guides to find a matching title
            const allGuides = document.querySelectorAll('.accordion-item');
            for (const guide of allGuides) {
                const title = guide.querySelector('h2').textContent.toLowerCase();
                // Check if the title contains the search term
                if (title.includes(searchTerm)) {
                    targetGuide = guide;
                    break; // Stop at the first match
                }
            }
        }

        // If we found a target (via either method), activate it
        if (targetGuide) {
            setTimeout(() => {
                // Check if it's already open (to avoid double toggling)
                if (!targetGuide.classList.contains('active')) {
                    targetGuide.querySelector('.accordion-header').click();
                }

                targetGuide.classList.add('deeplink-highlight');
                targetGuide.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    targetGuide.classList.remove('deeplink-highlight');
                }, 2500);

            }, 200);
        }
    };

    // --- Function 9: Animate the search input placeholder text ---
    const setupRotatingPlaceholder = () => {
        const searchInput = document.getElementById('searchInput');

        // Safety check: if the search input doesn't exist, do nothing.
        if (!searchInput) {
            return;
        }

        const placeholderPrompts = [
            "Search for 'password reset'...",
            "Try searching for 'buy data'...",
            "Looking for 'commissions'?",
            "Try searching 'how to activate'...",
            "Find the guide on 'upgrading'...",
            "Search for 'wallet funding'...",
            "Try searching 'cable tv'...",
            "How do I 'contact support'?",
            "Search by content or title...",
            "Find any guide instantly...",
            "Try searching 'referral link'...",
            "Type here to find what you need...",
            "Search guides by title or content...",
            "Type what you are looking for here...",
            "Try searching 'how to register'..."
        ];
        let currentIndex = 0;

        // Set an interval to run the code every 10 seconds
        setInterval(() => {
            // 1. Trigger the fade-out effect by adding a class
            searchInput.classList.add('placeholder-fade-out');

            // 2. Wait for the fade-out to finish
            setTimeout(() => {
                // 3. Cycle to the next prompt
                currentIndex = (currentIndex + 1) % placeholderPrompts.length;

                // 4. Update the placeholder text
                searchInput.placeholder = placeholderPrompts[currentIndex];

                // 5. Trigger the fade-in effect by removing the class
                searchInput.classList.remove('placeholder-fade-out');
            }, 500); // This must match the CSS transition duration

        }, 15000); // 15-second interval
    };

    // --- START: New Toolkit Logic ---

    // Helper function for visual feedback on copy buttons
    const giveCopyFeedback = (button, iconClass, text) => {
        const originalHTML = button.innerHTML;
        button.innerHTML = `<i class="fas fa-check"></i> Copied!`;
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
    };

    // The specific logic for our Registration Toolkit
    const setupRegistrationToolkit = (formJson) => {
        const formWrapper = document.getElementById(formJson.id);
        const { plans, details } = formJson.text_blocks;

        const combinedText = `${plans}\n\n${details}`;

        // Create the HTML structure for the toolkit
        formWrapper.innerHTML = `
        <div class="toolkit-section">
            <h4>Plans & Benefits Message</h4>
            <textarea readonly>${plans}</textarea>
            <button class="toolkit-copy-btn" data-copy-target="plans"><i class="fas fa-copy"></i> Copy Plans & Benefits</button>
        </div>
        <div class="toolkit-section">
            <h4>Registration Details Form</h4>
            <textarea readonly>${details}</textarea>
            <button class="toolkit-copy-btn" data-copy-target="details"><i class="fas fa-copy"></i> Copy Registration Form</button>
        </div>
        <button class="form-action-btn" data-copy-target="all"><i class="fas fa-clipboard-list"></i> Copy Both Messages Together</button>
    `;

        // Add event listeners to all new buttons
        const copyPlansBtn = formWrapper.querySelector('[data-copy-target="plans"]');
        const copyDetailsBtn = formWrapper.querySelector('[data-copy-target="details"]');
        const copyAllBtn = formWrapper.querySelector('[data-copy-target="all"]');

        copyPlansBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(plans);
            giveCopyFeedback(copyPlansBtn);
        });

        copyDetailsBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(details);
            giveCopyFeedback(copyDetailsBtn);
        });

        copyAllBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(combinedText);
            giveCopyFeedback(copyAllBtn);
        });

        // Auto-resize textareas to fit their content
        formWrapper.querySelectorAll('textarea').forEach(textarea => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
    };

    // --- END: New Toolkit Logic ---

    // --- Function 9: Track Video Hub Clicks ---
    const setupClickTracking = () => {
        const videoButton = document.querySelector('.video-hub-link');

        if (videoButton) {
            videoButton.addEventListener('click', async () => {
                console.log("Video hub button clicked. Sending stats to Firestore...");

                try {
                    // 1. Create a reference to the specific document in the database
                    // Syntax: doc(database, "collection_name", "document_name")
                    const statsRef = doc(db, "app_stats", "general_analytics");

                    // 2. Update the document
                    // We use 'increment(1)' which is a special Firebase tool. 
                    // It safely adds 1 to the existing number, even if 100 people click at once.
                    await updateDoc(statsRef, {
                        video_hub_clicks: increment(1)
                    });

                    console.log("Click count incremented successfully!");
                } catch (error) {
                    console.error("Error updating click count:", error);
                }
            });
        }
    };

    // --- Function 10: Display Real-time Click Count ---
    const setupRealtimeCounter = () => {
        const counterSpan = document.querySelector('.click-counter');

        // Safety check
        if (!counterSpan) return;

        // Reference to the database document
        const statsRef = doc(db, "app_stats", "general_analytics");

        // "onSnapshot" sets up a permanent connection.
        // Whenever the database changes, this code runs automatically.
        onSnapshot(statsRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                // Get the number, or default to 0 if it doesn't exist yet
                const count = data.video_hub_clicks || 0;

                // Update the text on the screen
                counterSpan.textContent = `Total Clicks: ${count}`;
            } else {
                // If the document doesn't exist yet (first run), show 0
                counterSpan.textContent = `Total Clicks: 0`;
            }
        });
    };

    // --- Function: Setup Search Logic (Extracted for cleanliness) ---
    const setupSearchLogic = (instructions) => {
        const searchInput = document.getElementById('searchInput');
        const noResultsMessage = document.getElementById('no-results-message');

        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            let matchesFound = 0;

            instructions.forEach((guide, index) => {
                const guideTitle = guide.title.toLowerCase();
                const guideContent = guide.content.toLowerCase();
                const isMatch = guideTitle.includes(searchTerm) || guideContent.includes(searchTerm);

                const guideElement = document.querySelector(`[data-guide-index="${index + 1}"]`);

                if (guideElement) {
                    if (isMatch) {
                        guideElement.style.display = 'block';
                        matchesFound++;
                    } else {
                        guideElement.style.display = 'none';
                    }
                }
            });

            if (matchesFound > 0) {
                noResultsMessage.style.display = 'none';
            } else {
                noResultsMessage.style.display = 'block';
            }
        });
    };

    // --- Function 11: Setup Favorites System ---
    const setupFavoritesSystem = () => {
        const favoritesContainer = document.getElementById('favorites-container');
        const mainContainer = document.getElementById('accordion-container');

        // 1. Get saved favorites from LocalStorage (or empty array)
        let savedFavorites = JSON.parse(localStorage.getItem('tgrFavorites')) || [];

        // Helper: Sort function to keep the main list in 1, 2, 3 order
        const sortMainList = () => {
            const items = Array.from(mainContainer.children);
            items.sort((a, b) => {
                return parseInt(a.dataset.guideIndex) - parseInt(b.dataset.guideIndex);
            });
            items.forEach(item => mainContainer.appendChild(item));
        };

        // Helper: Update UI based on favorites list
        const updateFavoritesUI = () => {
            // First, check if we need to show the favorites container
            if (savedFavorites.length > 0) {
                favoritesContainer.style.display = 'block';
            } else {
                favoritesContainer.style.display = 'none';
            }

            // Loop through ALL items to check their status
            const allItems = document.querySelectorAll('.accordion-item');
            allItems.forEach(item => {
                const index = parseInt(item.dataset.guideIndex);
                const btn = item.querySelector('.favorite-btn');
                const icon = btn.querySelector('i');

                if (savedFavorites.includes(index)) {
                    // It IS a favorite
                    btn.classList.add('active');
                    icon.classList.remove('far'); // Outline
                    icon.classList.add('fas');    // Solid
                    favoritesContainer.appendChild(item); // Move to top
                } else {
                    // It is NOT a favorite
                    btn.classList.remove('active');
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    mainContainer.appendChild(item); // Move back to main list
                }
            });

            // Ensure the main list stays in 1-2-3 order after items return to it
            sortMainList();
        };

        // 2. Initial Run
        updateFavoritesUI();

        // 3. Add Event Listeners to Stars
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't open the accordion
                const index = parseInt(btn.dataset.index);

                if (savedFavorites.includes(index)) {
                    // Remove from favorites
                    savedFavorites = savedFavorites.filter(i => i !== index);
                } else {
                    // Add to favorites
                    savedFavorites.push(index);
                }

                // Save to browser memory
                localStorage.setItem('tgrFavorites', JSON.stringify(savedFavorites));

                // Update the screen
                updateFavoritesUI();
            });
        });
    };

    // --- Function: Fantastic 10 Growth Calculator (Complete Version) ---
    const calculateFantasticEarnings = (formJson) => {
        // 1. Get Inputs
        const packageSelect = document.getElementById('calcPackage');
        const duplicationInput = document.getElementById('duplicationFactor');
        const depthInput = document.getElementById('calculationDepth');
        const resultTextarea = document.getElementById(formJson.result.id);
        const resultWrapper = resultTextarea.parentElement;
        const calcBtn = document.getElementById(formJson.button.id);

        // 2. Parse User Values
        const width = parseInt(duplicationInput.value) || 10; // Default to 10
        let userDepth = parseInt(depthInput.value) || 5;      // Default to 5

        // Hard limit: Max 10 levels allowed by the system logic
        if (userDepth > 10) userDepth = 10;
        if (userDepth < 1) userDepth = 1;

        const pkgKey = packageSelect.value;
        const pkgName = packageSelect.options[packageSelect.selectedIndex].text;

        // 3. Define Package Data Map
        const packageData = {
            coral: { fee: 10000, maxDepth: 6, pv: 20, pvLimit: 1 },
            emerald: { fee: 20000, maxDepth: 7, pv: 40, pvLimit: 2 },
            sapphire: { fee: 30000, maxDepth: 8, pv: 60, pvLimit: 3 },
            ruby: { fee: 40000, maxDepth: 9, pv: 80, pvLimit: 4 },
            diamond: { fee: 50000, maxDepth: 10, pv: 100, pvLimit: 5 },
            exec_diamond: { fee: 100000, maxDepth: 10, pv: 200, pvLimit: 5 }
        };

        const activePkg = packageData[pkgKey];

        // 4. Determine Actual Loop Limit
        const actualLoopLimit = Math.min(userDepth, activePkg.maxDepth);

        // 5. Define Commission Percentage Helper
        const getLevelPercent = (level) => {
            if (level === 1) return 0.22;
            if (level === 2) return 0.05;
            if (level === 3) return 0.05;
            if (level === 4) return 0.025;
            return 0.015; // Levels 5 to 10
        };

        // 6. Perform Calculation
        let outputLines = [];
        let totalCash = 0;
        let totalPV = 0;
        let totalTeam = 0;

        outputLines.push(`*🚀 TGR 'FANTASTIC ${width}' EARNINGS POTENTIAL 🚀*`);
        outputLines.push(`Based on the ${pkgName} Plan`);
        outputLines.push(`Projection for ${actualLoopLimit} Levels in ${actualLoopLimit} Weeks or ${actualLoopLimit} Months\n`);

        for (let level = 1; level <= actualLoopLimit; level++) {
            // A: Team Size (Width ^ Level)
            const teamSize = Math.pow(width, level);

            // B: Level Cash Earnings (Fee * Level% * 0.95 Maintenance Fee)
            const grossComm = activePkg.fee * getLevelPercent(level);
            const netComm = grossComm * 0.95;
            const levelCash = teamSize * netComm;

            // C: Level PV (Only earn PV if Level <= PV Depth Limit)
            let levelPV = 0;
            if (level <= activePkg.pvLimit) {
                levelPV = teamSize * activePkg.pv;
            }

            // Aggregate Totals
            totalTeam += teamSize;
            totalCash += levelCash;
            totalPV += levelPV;

            // Format Currency
            const formattedCash = levelCash.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });

            outputLines.push(`Week ${level} -> Level ${level}: ${formattedCash}`);
        }

        // 7. Final Summaries
        const formattedTotalCash = totalCash.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });
        const formattedTotalPV = totalPV.toLocaleString();
        const formattedTotalTeam = totalTeam.toLocaleString();

        outputLines.push(`\n*_Total Earnings: ${formattedTotalCash}_* 💥`);

        // Add Amount in Words
        const amountInWords = convertNumberToWords(totalCash);
        outputLines.push(`( ${amountInWords} Naira Only )`);

        outputLines.push(`*_Total Cumulative PV: ${formattedTotalPV} PV_* 🌱`);
        outputLines.push(`_Total Team Size: ${formattedTotalTeam} partners_`);

        // --- NEW: Leadership Incentives Logic ---
        const incentives = [
            { pv: 25000, name: "International Trip Fund ✈️", value: "₦750,000", rawVal: 750000 },
            { pv: 100000, name: "First Car Fund 🚘", value: "₦5,000,000", rawVal: 5000000 },
            { pv: 250000, name: "Second Car Fund (Jeep) 🚙", value: "₦6,000,000", rawVal: 6000000 },
            { pv: 500000, name: "House Fund 🏠", value: "₦10,000,000", rawVal: 10000000 }
        ];

        // Find qualified incentives
        const qualifiedIncentives = incentives.filter(award => totalPV >= award.pv);

        if (qualifiedIncentives.length > 0) {
            outputLines.push(`\n🏆 *QUALIFIED INCENTIVES:*`);

            let totalIncentiveCash = 0;

            qualifiedIncentives.forEach(award => {
                outputLines.push(`✅ ${award.name} (${award.value})`);
                totalIncentiveCash += award.rawVal;
            });

            // --- NEW SUBTOTAL SECTION START ---
            const formattedIncentiveTotal = totalIncentiveCash.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });
            const incentiveWords = convertNumberToWords(totalIncentiveCash);

            outputLines.push(`\n➕ *Total Incentives Value: ${formattedIncentiveTotal}*`);
            outputLines.push(`( ${incentiveWords} Naira Only )`);
            // --- NEW SUBTOTAL SECTION END ---

            // Calculate Grand Total (Cash + Awards)
            const grandTotal = totalCash + totalIncentiveCash;
            const formattedGrandTotal = grandTotal.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });
            const grandTotalWords = convertNumberToWords(grandTotal);

            outputLines.push(`\n💰 *GRAND TOTAL VALUE (Cash + Awards):*`);
            outputLines.push(`*${formattedGrandTotal}*`);
            outputLines.push(`( ${grandTotalWords} Naira Only )`);
        }
        // ----------------------------------------

        // Warning if user wanted more levels than package allows
        if (userDepth > activePkg.maxDepth) {
            outputLines.push(`\n⚠️ _Note: Calculation stopped at Level ${activePkg.maxDepth} because that is the limit for this package._`);
        }

        outputLines.push(`\n_Note: Calculations include the 5% maintenance fee._`);

        // 8. Display Result
        const finalMessage = outputLines.join('\n');
        resultTextarea.value = finalMessage;
        resultWrapper.style.display = 'block';

        // Button Feedback
        const originalButtonText = calcBtn.innerHTML;
        calcBtn.innerHTML = '<i class="fas fa-check"></i> Calculated!';
        calcBtn.classList.add('generated');

        // Resize Accordion
        const accordionContent = resultWrapper.closest('.accordion-content');
        if (accordionContent) {
            resultTextarea.style.height = 'auto';
            resultTextarea.style.height = (resultTextarea.scrollHeight) + 'px';
            accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
        }

        // Add Copy Button
        if (!resultWrapper.querySelector('.copy-generated-text-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-generated-text-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Projection';
            resultWrapper.appendChild(copyBtn);

            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(finalMessage).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Projection';
                    }, 2000);
                });
            });
        }

        // Reset Calc Button
        setTimeout(() => {
            calcBtn.innerHTML = originalButtonText;
            calcBtn.classList.remove('generated');
        }, 2000);
    };

    // --- Helper Function: Convert Number to Words (Up to Trillions) ---
    const convertNumberToWords = (amount) => {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion'];

        // Handle zero or invalid numbers
        if (amount === 0) return 'Zero';

        // We only convert the whole number part (ignore kobo for words)
        let number = Math.floor(amount);
        let words = '';
        let scaleIndex = 0;

        // Process the number in chunks of 3 digits (1,234,567)
        while (number > 0) {
            let chunk = number % 1000;

            if (chunk > 0) {
                let chunkStr = '';
                let hundreds = Math.floor(chunk / 100);
                let remainder = chunk % 100;

                // Handle Hundreds
                if (hundreds > 0) {
                    chunkStr += units[hundreds] + ' Hundred';
                    if (remainder > 0) chunkStr += ' and ';
                }

                // Handle Tens and Units
                if (remainder > 0) {
                    if (remainder < 20) {
                        chunkStr += units[remainder];
                    } else {
                        let tenUnit = Math.floor(remainder / 10);
                        let unitUnit = remainder % 10;
                        chunkStr += tens[tenUnit];
                        if (unitUnit > 0) chunkStr += '-' + units[unitUnit];
                    }
                }

                // Add the Scale (Thousand, Million, etc.)
                // The logic: Current Chunk Words + Scale Name + Comma + Previous Words
                const scaleName = scales[scaleIndex];
                const separator = (words ? ', ' : ''); // Add comma if there are already words

                words = chunkStr + (scaleName ? ' ' + scaleName : '') + separator + words;
            }

            number = Math.floor(number / 1000); // Move to the next chunk
            scaleIndex++;
        }

        return words;
    };

    // --- Function: Display User Profile from URL ---
    const displayUserProfile = () => {
        const urlParams = new URLSearchParams(window.location.search);

        // Get params
        const rawName = urlParams.get('fullname');
        const refId = urlParams.get('refid');

        // If we don't have at least one of them, don't show the badge
        if (!rawName && !refId) return;

        const badge = document.getElementById('user-profile-badge');
        const nameEl = document.getElementById('header-fullname');
        const userEl = document.getElementById('header-username');

        // Process Name: Replace underscores or dashes with spaces & Decode URI components (for safety)
        if (rawName) {
            // e.g., "Dammie_Ayodele" or "Dammie-Ayodele" -> "Dammie Ayodele"
            const cleanName = rawName.replace(/[-_]/g, ' ');
            nameEl.textContent = cleanName;
        } else {
            nameEl.textContent = 'Welcome, Partner'; // Fallback
        }

        // Process Username
        if (refId) {
            userEl.textContent = `${refId}`;
        } else {
            userEl.style.display = 'none'; // Hide if no username
        }

        // Reveal the badge
        badge.style.display = 'flex';

        // Tell the header to make room for the badge (adds the CSS padding)
        document.querySelector('.app-header').classList.add('has-badge');
    };


    // --- Function 12: Smart Share Tool (Conditional) ---
    const setupSmartShare = () => {
        const shareBtn = document.getElementById('smart-share-btn');
        if (!shareBtn) return;

        // Check if RefID exists in the URL
        const currentUrl = new URL(window.location.href);
        const refId = currentUrl.searchParams.get('refid');

        // IF NO REFID: Stop here. The button remains hidden (display: none) from CSS.
        if (!refId) {
            return;
        }

        // IF REFID EXISTS: Show the button (using Flex to keep icon centered)
        shareBtn.style.display = 'flex';

        shareBtn.addEventListener('click', async () => {
            // 1. Construct the Share URL (Preserve RefID, remove Name)
            // We clone the URL so we don't modify the actual browser address bar
            const shareUrlObj = new URL(window.location.href);

            // Remove fullname so User A doesn't pass their name badge to User B
            shareUrlObj.searchParams.delete('fullname');

            // Clean URL string
            const shareUrl = shareUrlObj.toString();

            // 2. Define the Share Message
            const shareTitle = "TGR Playbook";
            const shareText = "🔥 Master your TGR business! Access all training guides, videos, and tools in one place. Use the TGR Playbook here:\n";

            // 3. Trigger Share
            if (navigator.share) {
                // Option A: Mobile Native Share Sheet
                try {
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: shareUrl
                    });
                    console.log('Content shared successfully');
                } catch (error) {
                    console.log('Error sharing:', error);
                }
            } else {
                // Option B: Desktop Fallback (WhatsApp Web)
                const fullMessage = encodeURIComponent(shareText + " " + shareUrl);
                const whatsappUrl = `https://api.whatsapp.com/send?text=${fullMessage}`;
                window.open(whatsappUrl, '_blank');
            }
        });
    };

    // --- Function 13: Setup Page Visit Tracking (Toggleable) ---
    const setupPageTracking = (settings) => {
        // 1. CHECK THE SWITCH: If settings missing or disabled, STOP immediately.
        if (!settings || !settings.enable_page_tracking) {
            console.log('Page tracking is disabled in settings.');
            return;
        }

        // 2. INCREMENT (Write)
        // We use sessionStorage to ensure we only count 1 visit per browser session
        // (Refresh won't spam the database, but closing/reopening browser will)
        if (!sessionStorage.getItem('visit_counted')) {
            const statsRef = doc(db, "app_stats", "general_analytics");
            updateDoc(statsRef, {
                page_visits: increment(1)
            }).catch(err => console.error("Tracking Error:", err));

            // Mark this session as counted
            sessionStorage.setItem('visit_counted', 'true');
        }

        // 3. CREATE UI (The Pill)
        const pill = document.createElement('div');
        pill.id = 'visit-pill';
        pill.innerHTML = `
        <span>Page Visits</span>
        <strong id="visit-count-display">...</strong>
    `;
        document.body.appendChild(pill);

        // 4. LISTEN (Read)
        const statsRef = doc(db, "app_stats", "general_analytics");
        onSnapshot(statsRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const visits = data.page_visits || 0;

                const display = document.getElementById('visit-count-display');
                if (display) display.textContent = visits.toLocaleString();
            }
        });
    };

    // --- Initial calls to run the app ---
    updateYear();
    await loadInstructions();
    setupRotatingButtonText();
    setupBackToTopButton();
    setupRotatingPlaceholder();
    handleDeeplinking();
    setupClickTracking();
    setupRealtimeCounter();
    displayUserProfile();
    setupSmartShare();

});


// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
