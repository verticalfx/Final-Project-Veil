// phone-input.js - Enhanced phone input handling

// Use the countryList from country-data.js instead of declaring it again
// Extended with formatting patterns
let phoneCountryList = countryList.map(country => ({
  ...country,
  pattern: country.pattern || `+${country.dialCode.length > 1 ? '.'.repeat(country.dialCode.length) : '.'} ... ... ...`
}));

// Sort countries alphabetically
phoneCountryList.sort((a, b) => a.name.localeCompare(b.name));

// Initialize phone input functionality
document.addEventListener('DOMContentLoaded', function() {
  initPhoneInput();
  setupOtpInputs();
  addPhoneInputStyles();
});

function initPhoneInput() {
  const phoneInput = document.getElementById('phoneInput');
  const countryTrigger = document.getElementById('countrySelectTrigger');
  const selectedFlag = document.getElementById('selectedFlag');
  const selectedCountryCode = document.getElementById('selectedCountryCode');
  
  if (!phoneInput || !countryTrigger || !selectedFlag || !selectedCountryCode) {
    console.error('Phone input elements not found');
    return;
  }
  
  // Set default country (e.g., United Kingdom)
  const defaultCountry = phoneCountryList.find(c => c.code === 'GB');
  if (defaultCountry) {
    updateSelectedCountry(defaultCountry);
    phoneInput.value = '+' + defaultCountry.dialCode + ' ';
  }
  
  // Create custom dropdown
  createCustomDropdown();
  
  // Add clear button functionality
  addClearButtonFunctionality();
}

function updateSelectedCountry(country) {
  const selectedFlag = document.getElementById('selectedFlag');
  const selectedCountryCode = document.getElementById('selectedCountryCode');
  
  if (selectedFlag && selectedCountryCode) {
    selectedFlag.style.backgroundImage = `url(https://flagcdn.com/24x18/${country.code.toLowerCase()}.png)`;
    selectedCountryCode.textContent = '+' + country.dialCode;
  }
}

function createCustomDropdown() {
  const phoneInputContainer = document.getElementById('phoneInputContainer');
  const countryTrigger = document.getElementById('countrySelectTrigger');
  
  if (!phoneInputContainer || !countryTrigger) return;
  
  // Create dropdown container
  const dropdown = document.createElement('div');
  dropdown.className = 'country-dropdown';
  dropdown.id = 'countryDropdown';
  
  // Add search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'country-search';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search countries...';
  searchInput.addEventListener('input', filterCountries);
  
  searchContainer.appendChild(searchInput);
  dropdown.appendChild(searchContainer);
  
  // Add country items
  const countryItemsContainer = document.createElement('div');
  countryItemsContainer.id = 'countryItems';
  
  phoneCountryList.forEach(country => {
    const item = createCountryItem(country);
    countryItemsContainer.appendChild(item);
  });
  
  dropdown.appendChild(countryItemsContainer);
  phoneInputContainer.appendChild(dropdown);
  
  // Toggle dropdown on trigger click
  countryTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('countryDropdown');
    const isActive = countryTrigger.classList.contains('active');
    
    if (isActive) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#countrySelectTrigger') && !e.target.closest('#countryDropdown')) {
      closeDropdown();
    }
  });
}

function createCountryItem(country) {
  const item = document.createElement('div');
  item.className = 'country-item';
  
  const flag = document.createElement('div');
  flag.className = 'country-item-flag';
  flag.style.backgroundImage = `url(https://flagcdn.com/24x18/${country.code.toLowerCase()}.png)`;
  
  const name = document.createElement('div');
  name.className = 'country-item-name';
  name.textContent = country.name;
  
  const code = document.createElement('div');
  code.className = 'country-item-code';
  code.textContent = '+' + country.dialCode;
  
  item.appendChild(flag);
  item.appendChild(name);
  item.appendChild(code);
  
  item.addEventListener('click', () => {
    selectCountry(country);
    closeDropdown();
  });
  
  return item;
}

function openDropdown() {
  const dropdown = document.getElementById('countryDropdown');
  const trigger = document.getElementById('countrySelectTrigger');
  if (dropdown && trigger) {
    dropdown.classList.add('show');
    trigger.classList.add('active');
    
    // Focus search input
    const searchInput = dropdown.querySelector('input');
    if (searchInput) {
      searchInput.focus();
    }
  }
}

function closeDropdown() {
  const dropdown = document.getElementById('countryDropdown');
  const trigger = document.getElementById('countrySelectTrigger');
  if (dropdown && trigger) {
    dropdown.classList.remove('show');
    trigger.classList.remove('active');
  }
}

function selectCountry(country) {
  updateSelectedCountry(country);
  
  const phoneInput = document.getElementById('phoneInput');
  if (phoneInput) {
    // Preserve the national number if it exists
    const currentNumber = phoneInput.value;
    const currentDialCode = extractDialCode(currentNumber);
    let nationalNumber = '';
    
    if (currentDialCode) {
      nationalNumber = currentNumber.substring(currentDialCode.length + 1).trim();
    }
    
    // Update the phone input with the new dial code and preserve the national number
    phoneInput.value = '+' + country.dialCode + (nationalNumber ? ' ' + nationalNumber : ' ');
    phoneInput.focus();
  }
}

// Filter countries in dropdown
function filterCountries(e) {
  const query = e.target.value.toLowerCase();
  const items = document.querySelectorAll('.country-item');
  
  items.forEach(item => {
    const name = item.querySelector('.country-item-name').textContent.toLowerCase();
    const code = item.querySelector('.country-item-code').textContent.toLowerCase();
    
    if (name.includes(query) || code.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Extract dial code from input
function extractDialCode(input) {
  if (!input.startsWith('+')) return null;
  
  // Remove the '+' and any non-digit characters
  const digitsOnly = input.substring(1).replace(/\D/g, '');
  
  // Try to match with country dial codes (longest first to avoid partial matches)
  const dialCodes = phoneCountryList.map(c => c.dialCode).sort((a, b) => b.length - a.length);
  
  for (const code of dialCodes) {
    if (digitsOnly.startsWith(code)) {
      return code;
    }
  }
  
  return null;
}

// Replace the onPhoneInput function with this improved version
function onPhoneInput(e) {
  const phoneInput = e.target;
  const countrySelect = document.getElementById('countrySelect');
  
  if (!phoneInput || !countrySelect) return;
  
  // Store cursor position before making changes
  const cursorPos = phoneInput.selectionStart;
  
  // Ensure the input starts with '+'
  if (!phoneInput.value.startsWith('+')) {
    phoneInput.value = '+' + phoneInput.value.replace(/^\+*/g, '');
  }
  
  // Get the selected country's dial code
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const dialCode = selectedOption.value;
  
  // Extract the dial code from the current input
  const currentDialCode = extractDialCode(phoneInput.value);
  
  // If the dial code changed, update the country selector
  if (currentDialCode && currentDialCode !== dialCode) {
    const matchingCountry = phoneCountryList.find(c => c.dialCode === currentDialCode);
    if (matchingCountry) {
      countrySelect.value = matchingCountry.dialCode;
      updateCountrySelectStyle();
    }
  }
  
  // Show/hide clear button based on input content
  const clearBtn = document.getElementById('phoneClearBtn');
  if (clearBtn) {
    if (phoneInput.value.length > dialCode.length + 1) { // +dialCode plus at least one digit
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }
  
  // Restore cursor position
  setTimeout(() => {
    phoneInput.setSelectionRange(cursorPos, cursorPos);
  }, 0);
}

// Add this function to format phone numbers (simplified version)
function formatPhoneNumber(rawNumber, pattern) {
  if (!pattern) return '+' + rawNumber;
  
  // For simplicity, just add spaces after the country code
  const dialCode = rawNumber.substring(0, Math.min(4, rawNumber.length));
  const nationalNumber = rawNumber.substring(dialCode.length);
  
  // Format with spaces every 3-4 digits
  let formatted = '+' + dialCode + ' ';
  
  // Add the national number with spaces
  for (let i = 0; i < nationalNumber.length; i++) {
    formatted += nationalNumber[i];
    if ((i + 1) % 3 === 0 && i < nationalNumber.length - 1) {
      formatted += ' ';
    }
  }
  
  return formatted;
}

// Add this new function to format the phone number when the input loses focus
function onPhoneInputBlur(e) {
  const phoneInput = e.target;
  const countrySelect = document.getElementById('countrySelect');
  
  if (!phoneInput || !countrySelect) return;
  
  // Get the raw input without formatting
  const rawInput = phoneInput.value.replace(/\D/g, '');
  
  // Get the selected country's dial code and pattern
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const dialCode = selectedOption.value;
  const pattern = selectedOption.dataset.pattern;
  
  // Format the number according to the pattern
  const formattedNumber = formatPhoneNumber(rawInput, pattern);
  
  // Update the input value with the formatted number
  phoneInput.value = formattedNumber;
}

// Add this new function to handle the phone input when it receives focus
function onPhoneInputFocus(e) {
  const phoneInput = e.target;
  const countrySelect = document.getElementById('countrySelect');
  
  if (!phoneInput || !countrySelect) return;
  
  // Get the selected country's dial code
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const dialCode = selectedOption.value;
  
  // Get the raw digits from the current input
  const currentInput = phoneInput.value;
  const rawDigits = currentInput.replace(/\D/g, '');
  
  // Ensure we preserve the dial code
  if (rawDigits.startsWith(dialCode)) {
    // Keep the dial code and the national number without formatting
    const nationalNumber = rawDigits.substring(dialCode.length);
    phoneInput.value = '+' + dialCode + ' ' + nationalNumber;
  } else {
    // If somehow the dial code is missing, restore it
    phoneInput.value = '+' + dialCode + ' ';
  }
  
  // Position cursor at the end
  setTimeout(() => {
    phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
  }, 0);
}

// Replace the preventNonNumeric function with this improved version
function preventNonNumeric(e) {
  const phoneInput = e.target;
  const countrySelect = document.getElementById('countrySelect');
  
  if (!phoneInput || !countrySelect) return;
  
  // Get the selected country's dial code
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const dialCode = selectedOption.value;
  
  // Always allow: backspace, delete, tab, escape, enter, and navigation keys
  if ([8, 9, 13, 27, 46, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true)) {
    
    // Special handling for backspace to prevent deleting the country code
    if (e.keyCode === 8) { // Backspace key
      const cursorPos = phoneInput.selectionStart;
      const selectionLength = phoneInput.selectionEnd - phoneInput.selectionStart;
      
      // If there's a selection that includes part of the dial code, prevent deletion
      if (selectionLength > 0 && phoneInput.selectionStart <= dialCode.length + 1) {
        e.preventDefault();
        return;
      }
      
      // Prevent deleting the plus sign or dial code
      if (cursorPos <= dialCode.length + 1 && selectionLength === 0) {
        e.preventDefault();
        return;
      }
    }
    
    return;
  }
  
  // Allow '+' only at the beginning
  if (e.key === '+' && phoneInput.selectionStart === 0) {
    return;
  }
  
  // Prevent input if not a number
  if (!/[0-9]/.test(e.key)) {
    e.preventDefault();
  }
}

// Update the country select with a flag icon
function updateCountrySelectStyle() {
  const countrySelect = document.getElementById('countrySelect');
  const phoneInputContainer = document.getElementById('phoneInputContainer');
  const flagIcon = document.getElementById('countryFlag');
  
  if (!countrySelect || !phoneInputContainer) return;
  
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const countryCode = selectedOption.dataset.code.toLowerCase();
  
  // Create or update the flag icon
  if (!flagIcon) {
    const newFlagIcon = document.createElement('div');
    newFlagIcon.id = 'countryFlag';
    newFlagIcon.className = 'country-flag';
    newFlagIcon.style.backgroundImage = `url(https://flagcdn.com/24x18/${countryCode}.png)`;
    
    // Insert before the phone input
    const phoneInputWrapper = document.querySelector('.phone-input-wrapper');
    if (phoneInputWrapper) {
      const countrySelectContainer = phoneInputWrapper.querySelector('.country-select-container');
      if (countrySelectContainer) {
        countrySelectContainer.insertBefore(newFlagIcon, countrySelectContainer.firstChild);
      }
    }
  } else {
    flagIcon.style.backgroundImage = `url(https://flagcdn.com/24x18/${countryCode}.png)`;
  }
}

// Validate phone number before submission
function validatePhoneNumber() {
  const phoneInput = document.getElementById('phoneInput');
  const phoneError = document.getElementById('phoneError');
  
  if (!phoneInput || !phoneError) return false;
  
  const phoneNumber = phoneInput.value.trim();
  const rawNumber = phoneNumber.replace(/\D/g, '');
  
  // Basic validation
  if (!phoneNumber) {
    phoneError.textContent = 'Please enter your phone number.';
    return false;
  }
  
  if (rawNumber.length < 7) {
    phoneError.textContent = 'Phone number is too short.';
    return false;
  }
  
  // Clear any previous errors
  phoneError.textContent = '';
  return true;
}

// Export the phone number in E.164 format (for API calls)
function getE164PhoneNumber() {
  const phoneInput = document.getElementById('phoneInput');
  if (!phoneInput) return '';
  
  // Remove all non-digit characters except the leading '+'
  return phoneInput.value.replace(/[^\d+]/g, '');
}

// Replace the setupOtpInputs function with this improved version
function setupOtpInputs() {
  const otpInputs = document.querySelectorAll('.otp-input');
  const otpHiddenInput = document.getElementById('otpInput');
  
  if (!otpInputs.length || !otpHiddenInput) return;
  
  // Add event listeners to each OTP input
  otpInputs.forEach((input, index) => {
    // Use keyup instead of input event for better control
    input.addEventListener('keyup', (e) => {
      // Skip if it's a navigation key
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Shift', 'Control', 'Alt'].includes(e.key)) {
        return;
      }
      
      const value = e.target.value;
      
      // Only allow digits
      if (!/^\d*$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
        return;
      }
      
      // If a digit was entered and the field has a value, move to next input
      if (value && index < otpInputs.length - 1) {
        // Only move to next input if this one is filled
        otpInputs[index + 1].focus();
        otpInputs[index + 1].select();
      }
      
      // Update the hidden input with all values
      updateOtpValue();
    });
    
    // Handle paste event to distribute digits across inputs
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      
      // Get pasted data
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      
      // Filter out non-digits
      const digits = pastedData.replace(/\D/g, '');
      
      // Distribute digits across inputs
      for (let i = 0; i < digits.length && i + index < otpInputs.length; i++) {
        otpInputs[i + index].value = digits[i];
      }
      
      // Focus the next empty input or the last one
      let nextEmptyIndex = index + digits.length;
      if (nextEmptyIndex >= otpInputs.length) {
        nextEmptyIndex = otpInputs.length - 1;
      }
      
      otpInputs[nextEmptyIndex].focus();
      
      // Update the hidden input
      updateOtpValue();
    });
    
    // Handle input event to catch all changes
    input.addEventListener('input', (e) => {
      // If more than one character is entered, keep only the first one
      if (e.target.value.length > 1) {
        e.target.value = e.target.value[0];
      }
      
      // Update the hidden input with all values
      updateOtpValue();
    });
    
    // Handle keydown for navigation and backspace
    input.addEventListener('keydown', (e) => {
      // Handle backspace to go to previous input
      if (e.key === 'Backspace') {
        if (!e.target.value && index > 0) {
          // If current input is empty, go to previous input
          otpInputs[index - 1].focus();
          otpInputs[index - 1].select();
          e.preventDefault(); // Prevent the default backspace behavior
        }
      } 
      // Handle left arrow to navigate to previous input
      else if (e.key === 'ArrowLeft' && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].select();
      } 
      // Handle right arrow to navigate to next input
      else if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
        otpInputs[index + 1].select();
      }
    });
    
    // Select all text when focused
    input.addEventListener('focus', (e) => {
      e.target.select();
    });
  });
  
  // Function to update the hidden OTP input
  function updateOtpValue() {
    let otpValue = '';
    otpInputs.forEach(input => {
      otpValue += input.value;
    });
    otpHiddenInput.value = otpValue;
  }
}

// Update the autoFillOtpInputs function to handle 6 digits
function autoFillOtpInputs(otp) {
    if (!otp) return;
    
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpHiddenInput = document.getElementById('otpInput');
    
    // Make sure we have the right number of inputs
    if (otpInputs.length !== otp.length) {
        console.warn(`OTP length (${otp.length}) doesn't match input fields (${otpInputs.length})`);
    }
    
    // Fill in as many digits as we have inputs for
    const otpDigits = otp.split('');
    otpInputs.forEach((input, index) => {
        if (index < otpDigits.length) {
            input.value = otpDigits[index];
            input.classList.add('border-purple-primary');
        } else {
            input.value = '';
            input.classList.remove('border-purple-primary');
        }
    });
    
    // Update the hidden input with the full OTP
    if (otpHiddenInput) {
        otpHiddenInput.value = otp;
    }
}

// Update the fillDemoOtp function to handle variable length OTPs
window.fillDemoOtp = function() {
    // Try to get the demo code from the UI
    const demoCodeElement = document.querySelector('#stepOTP .bg-dark-tertiary p.text-white.text-xl');
    if (!demoCodeElement) return;
    
    const demoCode = demoCodeElement.textContent.trim();
    if (!demoCode) return;
    
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpHiddenInput = document.getElementById('otpInput');
    
    // Fill in the OTP inputs
    if (otpInputs.length) {
        const codeDigits = demoCode.split('');
        otpInputs.forEach((input, index) => {
            if (index < codeDigits.length) {
                input.value = codeDigits[index];
                input.classList.add('border-purple-primary');
            }
        });
        
        // Update the hidden input with the complete OTP
        if (otpHiddenInput) {
            otpHiddenInput.value = demoCode;
        }
        
        // Trigger verification after a short delay
        setTimeout(() => {
            const verifyBtn = document.getElementById('verifyButton');
            if (verifyBtn) {
                verifyBtn.click();
            }
        }, 500);
    }
};

// Override the startPhoneLogin function to use our validation
window.originalStartPhoneLogin = window.startPhoneLogin;
window.startPhoneLogin = function() {
  if (validatePhoneNumber()) {
    // Get the E.164 formatted number
    const e164Number = getE164PhoneNumber();
    
    // Update the phone input value with the E.164 format
    document.getElementById('phoneInput').value = e164Number;
    
    // Call the original function
    if (typeof window.originalStartPhoneLogin === 'function') {
      window.originalStartPhoneLogin();
    }
  }
};

// Update the resendOtp function to use the token in the header
window.resendOtp = async function() {
  const otpError = document.getElementById('otpError');
  if (otpError) otpError.textContent = '';
  
  // Get the request token from authState
  const requestToken = window.authState?.requestToken;
  
  if (!requestToken) {
    if (otpError) otpError.textContent = 'Session expired. Please go back and try again.';
    return;
  }
  
  try {
    // Use the /resend endpoint with the request token in the header
    const res = await fetch('http://localhost:4000/auth/resend', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-otp-request-token': requestToken // Use the exact same header name
      },
      body: JSON.stringify({ 
        phoneNumber: window.authState.phoneNumber 
      })
    });
    
    // Check for a new token in the response headers
    const newRequestToken = res.headers.get('x-otp-request-token');
    if (newRequestToken && window.authState) {
      window.authState.requestToken = newRequestToken;
      console.log('Updated request token from headers:', window.authState.requestToken);
    }
    
    const data = await res.json();
    
    if (data.error) {
      if (otpError) otpError.textContent = data.error;
      return;
    }
    
    // Show success message
    if (window.Toast) {
      window.Toast.fire({
        icon: 'success',
        title: 'OTP resent successfully!',
      });
    } else {
      alert('OTP resent successfully!');
    }
    
    // Clear the OTP inputs
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpHiddenInput = document.getElementById('otpInput');
    
    otpInputs.forEach(input => {
      input.value = '';
      input.classList.remove('border-purple-primary');
    });
    
    if (otpHiddenInput) otpHiddenInput.value = '';
    
    // Focus the first input
    if (otpInputs.length) otpInputs[0].focus();
    
    // If in demo mode and OTP is provided, auto-fill after a delay
    if (data.otp) {
      setTimeout(() => {
        autoFillOtpInputs(data.otp);
      }, 500);
    }
  } catch (err) {
    console.error(err);
    if (otpError) otpError.textContent = 'Failed to resend OTP. Please try again.';
  }
};

// Replace the goBackToPhone function with this improved version
window.goBackToPhone = function() {
  // Clear any error messages
  const phoneError = document.getElementById('phoneError');
  const otpError = document.getElementById('otpError');
  const nameError = document.getElementById('nameError');
  
  if (phoneError) phoneError.textContent = '';
  if (otpError) otpError.textContent = '';
  if (nameError) nameError.textContent = '';
  
  // Clear OTP inputs
  const otpInputs = document.querySelectorAll('.otp-input');
  const otpHiddenInput = document.getElementById('otpInput');
  
  if (otpInputs.length) {
    otpInputs.forEach(input => {
      input.value = '';
      input.classList.remove('border-purple-primary');
    });
  }
  
  if (otpHiddenInput) otpHiddenInput.value = '';
  
  // Show phone step, hide other steps
  // First check which step elements exist in the DOM
  const stepOTP = document.getElementById('stepOTP');
  const stepPhone = document.getElementById('stepPhone');
  const otpStep = document.getElementById('otpStep');
  const phoneStep = document.getElementById('phoneStep');
  
  // Handle both naming conventions
  if (stepOTP && stepPhone) {
    stepOTP.classList.add('hidden');
    stepPhone.classList.remove('hidden');
  }
  
  if (otpStep && phoneStep) {
    otpStep.classList.add('hidden');
    phoneStep.classList.remove('hidden');
  }
  
  // Focus on the phone input
  const phoneInput = document.getElementById('phoneInput');
  if (phoneInput) {
    setTimeout(() => {
      phoneInput.focus();
    }, 100);
  }
  
  // Log for debugging
  console.log('Going back to phone step');
};

// Add this function to update the progress indicator
function updateProgressIndicator(step) {
  const steps = ['phone', 'verification', 'profile'];
  const currentIndex = steps.indexOf(step);
  
  if (currentIndex === -1) return;
  
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressLines = document.querySelectorAll('.progress-line');
  
  progressSteps.forEach((stepEl, index) => {
    if (index < currentIndex) {
      stepEl.classList.add('completed');
      stepEl.classList.remove('active');
    } else if (index === currentIndex) {
      stepEl.classList.add('active');
      stepEl.classList.remove('completed');
    } else {
      stepEl.classList.remove('active', 'completed');
    }
  });
  
  progressLines.forEach((line, index) => {
    if (index < currentIndex) {
      line.classList.add('active');
    } else {
      line.classList.remove('active');
    }
  });
}

// Update the showStep and hideStep functions to call updateProgressIndicator
window.showStep = function(id) {
  const element = document.getElementById(id);
  if (element) element.classList.remove('hidden');
  
  // Update progress indicator
  if (id === 'stepPhone') updateProgressIndicator('phone');
  else if (id === 'stepOTP') updateProgressIndicator('verification');
  else if (id === 'stepName' || id === 'stepBio') updateProgressIndicator('profile');
};

// Add this new function to handle the clear button
function addClearButtonFunctionality() {
  // Create clear button if it doesn't exist
  let clearBtn = document.getElementById('phoneClearBtn');
  const phoneInputWrapper = document.querySelector('.phone-input-wrapper');
  const phoneInput = document.getElementById('phoneInput');
  
  if (!clearBtn && phoneInputWrapper && phoneInput) {
    clearBtn = document.createElement('button');
    clearBtn.id = 'phoneClearBtn';
    clearBtn.type = 'button';
    clearBtn.className = 'phone-clear-btn hidden';
    clearBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
    phoneInputWrapper.appendChild(clearBtn);
    
    // Add click event to clear the input
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Get the selected country's dial code
      const countrySelect = document.getElementById('countrySelect');
      const selectedOption = countrySelect.options[countrySelect.selectedIndex];
      const dialCode = selectedOption.value;
      
      // Reset to just the dial code
      phoneInput.value = '+' + dialCode + ' ';
      clearBtn.classList.add('hidden');
      phoneInput.focus();
    });
  }
}

// Add these styles to the document
function addPhoneInputStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .phone-clear-btn {
      position: absolute;
      right: 10px;
      color: #6b7280;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .phone-clear-btn:hover {
      color: #f87171;
    }
    
    .phone-input-wrapper {
      position: relative;
    }
    
    .phone-input {
      padding-right: 30px !important;
    }
  `;
  document.head.appendChild(styleEl);
}

// Add validation function
function validatePhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    return digitsOnly.length >= 10;
}

// Add this to the existing phone input setup
function setupPhoneInput() {
    const phoneInput = document.getElementById('phoneInput');
    const countrySelect = document.getElementById('countrySelect');
    const phoneClearBtn = document.getElementById('phoneClearBtn');
    const phoneError = document.getElementById('phoneError');

    if (!phoneInput || !countrySelect) {
        console.error('Phone input elements not found');
        return;
    }

    // Clear button functionality
    if (phoneClearBtn) {
        phoneClearBtn.addEventListener('click', () => {
            phoneInput.value = '';
            phoneClearBtn.classList.add('hidden');
            phoneInput.focus();
            phoneError.textContent = '';
        });
    }

    // Input handling
    phoneInput.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Show/hide clear button
        if (phoneClearBtn) {
            phoneClearBtn.classList.toggle('hidden', !value);
        }
        
        // Clear error on input
        phoneError.textContent = '';
    });

    // Prevent form submission on enter
    phoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });
}

// Modify the startPhoneLogin function
window.startPhoneLogin = function() {
    const phoneInput = document.getElementById('phoneInput');
    const countrySelect = document.getElementById('countrySelect');
    const phoneError = document.getElementById('phoneError');

    if (!phoneInput || !countrySelect) {
        console.error('Phone input elements not found');
        return;
    }

    const phoneNumber = phoneInput.value.trim();
    const countryCode = countrySelect.value;

    // Validate phone number
    if (!phoneNumber) {
        phoneError.textContent = 'Please enter a phone number';
        phoneInput.focus();
        return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
        phoneError.textContent = 'Phone number must be at least 10 digits';
        phoneInput.focus();
        return;
    }

    // If validation passes, proceed with login
    const fullPhoneNumber = countryCode + phoneNumber;
    console.log('Starting phone login with:', fullPhoneNumber);

    // Show demo mode notice
    const demoModeNotice = document.querySelector('#stepPhone .bg-dark-tertiary');
    if (demoModeNotice) {
        demoModeNotice.classList.remove('hidden');
    }

    // Hide phone step and show OTP step
    document.getElementById('stepPhone').classList.add('hidden');
    document.getElementById('stepOTP').classList.remove('hidden');

    // Update progress indicator
    document.querySelector('[data-step="phone"]').classList.add('completed');
    document.querySelector('[data-step="verification"]').classList.add('active');
};

// Initialize phone input on load
document.addEventListener('DOMContentLoaded', () => {
    setupPhoneInput();
    populateCountrySelect();
}); 