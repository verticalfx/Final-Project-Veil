// country-data.js - Country data for phone input

// Country list with dial codes and formatting patterns
const countryList = [
  { name: 'Afghanistan', code: 'AF', dialCode: '93', pattern: '+.. ... ... ...' },
  { name: 'Albania', code: 'AL', dialCode: '355', pattern: '+... .. ... ....' },
  { name: 'Algeria', code: 'DZ', dialCode: '213', pattern: '+... ... ... ...' },
  { name: 'Andorra', code: 'AD', dialCode: '376', pattern: '+... ... ...' },
  { name: 'Angola', code: 'AO', dialCode: '244', pattern: '+... ... ... ...' },
  { name: 'Argentina', code: 'AR', dialCode: '54', pattern: '+.. .. .... ....' },
  { name: 'Armenia', code: 'AM', dialCode: '374', pattern: '+... .. ... ...' },
  { name: 'Australia', code: 'AU', dialCode: '61', pattern: '+.. ... ... ...' },
  { name: 'Austria', code: 'AT', dialCode: '43', pattern: '+.. ... ... ....' },
  { name: 'Azerbaijan', code: 'AZ', dialCode: '994', pattern: '+... .. ... .. ..' },
  { name: 'Bahamas', code: 'BS', dialCode: '1242', pattern: '+.... ... ....' },
  { name: 'Bahrain', code: 'BH', dialCode: '973', pattern: '+... .... ....' },
  { name: 'Bangladesh', code: 'BD', dialCode: '880', pattern: '+... .... ... ...' },
  { name: 'Barbados', code: 'BB', dialCode: '1246', pattern: '+.... ... ....' },
  { name: 'Belarus', code: 'BY', dialCode: '375', pattern: '+... .. ... .. ..' },
  { name: 'Belgium', code: 'BE', dialCode: '32', pattern: '+.. ... .. .. ..' },
  { name: 'Belize', code: 'BZ', dialCode: '501', pattern: '+... ... ....' },
  { name: 'Brazil', code: 'BR', dialCode: '55', pattern: '+.. .. ..... ....' },
  { name: 'Bulgaria', code: 'BG', dialCode: '359', pattern: '+... ... ... ...' },
  { name: 'Canada', code: 'CA', dialCode: '1', pattern: '+. (...) ...-....' },
  { name: 'China', code: 'CN', dialCode: '86', pattern: '+.. ... .... ....' },
  { name: 'Colombia', code: 'CO', dialCode: '57', pattern: '+.. ... ... ....' },
  { name: 'Croatia', code: 'HR', dialCode: '385', pattern: '+... .. ... ....' },
  { name: 'Cuba', code: 'CU', dialCode: '53', pattern: '+.. . ... ....' },
  { name: 'Cyprus', code: 'CY', dialCode: '357', pattern: '+... .. ... ...' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '420', pattern: '+... ... ... ...' },
  { name: 'Denmark', code: 'DK', dialCode: '45', pattern: '+.. .. .. .. ..' },
  { name: 'Egypt', code: 'EG', dialCode: '20', pattern: '+.. ... ... ....' },
  { name: 'Estonia', code: 'EE', dialCode: '372', pattern: '+... .... ....' },
  { name: 'Finland', code: 'FI', dialCode: '358', pattern: '+... .. ... .. ..' },
  { name: 'France', code: 'FR', dialCode: '33', pattern: '+.. . .. .. .. ..' },
  { name: 'Germany', code: 'DE', dialCode: '49', pattern: '+.. ... ... ....' },
  { name: 'Greece', code: 'GR', dialCode: '30', pattern: '+.. ... ... ....' },
  { name: 'Hong Kong', code: 'HK', dialCode: '852', pattern: '+... .... ....' },
  { name: 'Hungary', code: 'HU', dialCode: '36', pattern: '+.. .. ... ....' },
  { name: 'Iceland', code: 'IS', dialCode: '354', pattern: '+... ... ....' },
  { name: 'India', code: 'IN', dialCode: '91', pattern: '+.. ..... .....' },
  { name: 'Indonesia', code: 'ID', dialCode: '62', pattern: '+.. ... ... ....' },
  { name: 'Iran', code: 'IR', dialCode: '98', pattern: '+.. ... ... ....' },
  { name: 'Iraq', code: 'IQ', dialCode: '964', pattern: '+... ... ... ....' },
  { name: 'Ireland', code: 'IE', dialCode: '353', pattern: '+... .. ... ....' },
  { name: 'Israel', code: 'IL', dialCode: '972', pattern: '+... .. ... ....' },
  { name: 'Italy', code: 'IT', dialCode: '39', pattern: '+.. ... ... ....' },
  { name: 'Japan', code: 'JP', dialCode: '81', pattern: '+.. ... ... ....' },
  { name: 'Jordan', code: 'JO', dialCode: '962', pattern: '+... . .... ....' },
  { name: 'Kenya', code: 'KE', dialCode: '254', pattern: '+... ... ... ...' },
  { name: 'Kuwait', code: 'KW', dialCode: '965', pattern: '+... .... ....' },
  { name: 'Latvia', code: 'LV', dialCode: '371', pattern: '+... .... ....' },
  { name: 'Lebanon', code: 'LB', dialCode: '961', pattern: '+... . ... ...' },
  { name: 'Libya', code: 'LY', dialCode: '218', pattern: '+... .. ... ....' },
  { name: 'Lithuania', code: 'LT', dialCode: '370', pattern: '+... ... .....' },
  { name: 'Luxembourg', code: 'LU', dialCode: '352', pattern: '+... ... ...' },
  { name: 'Malaysia', code: 'MY', dialCode: '60', pattern: '+.. .. ... ....' },
  { name: 'Mexico', code: 'MX', dialCode: '52', pattern: '+.. ... ... ....' },
  { name: 'Morocco', code: 'MA', dialCode: '212', pattern: '+... ... ... ...' },
  { name: 'Netherlands', code: 'NL', dialCode: '31', pattern: '+.. . .. .. .. ..' },
  { name: 'New Zealand', code: 'NZ', dialCode: '64', pattern: '+.. .. ... ....' },
  { name: 'Nigeria', code: 'NG', dialCode: '234', pattern: '+... ... ... ....' },
  { name: 'Norway', code: 'NO', dialCode: '47', pattern: '+.. ... .. ...' },
  { name: 'Pakistan', code: 'PK', dialCode: '92', pattern: '+.. ... ... ....' },
  { name: 'Peru', code: 'PE', dialCode: '51', pattern: '+.. ... ... ...' },
  { name: 'Philippines', code: 'PH', dialCode: '63', pattern: '+.. ... ... ....' },
  { name: 'Poland', code: 'PL', dialCode: '48', pattern: '+.. ... ... ...' },
  { name: 'Portugal', code: 'PT', dialCode: '351', pattern: '+... ... ... ...' },
  { name: 'Qatar', code: 'QA', dialCode: '974', pattern: '+... .... ....' },
  { name: 'Romania', code: 'RO', dialCode: '40', pattern: '+.. ... ... ...' },
  { name: 'Russia', code: 'RU', dialCode: '7', pattern: '+. ... ... .. ..' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '966', pattern: '+... .. ... ....' },
  { name: 'Singapore', code: 'SG', dialCode: '65', pattern: '+.. .... ....' },
  { name: 'Slovakia', code: 'SK', dialCode: '421', pattern: '+... ... ... ...' },
  { name: 'Slovenia', code: 'SI', dialCode: '386', pattern: '+... .. ... ...' },
  { name: 'South Africa', code: 'ZA', dialCode: '27', pattern: '+.. .. ... ....' },
  { name: 'South Korea', code: 'KR', dialCode: '82', pattern: '+.. .. ... ....' },
  { name: 'Spain', code: 'ES', dialCode: '34', pattern: '+.. ... ... ...' },
  { name: 'Sweden', code: 'SE', dialCode: '46', pattern: '+.. .. ... .. ..' },
  { name: 'Switzerland', code: 'CH', dialCode: '41', pattern: '+.. .. ... .. ..' },
  { name: 'Taiwan', code: 'TW', dialCode: '886', pattern: '+... ... ... ...' },
  { name: 'Thailand', code: 'TH', dialCode: '66', pattern: '+.. .. ... ....' },
  { name: 'Turkey', code: 'TR', dialCode: '90', pattern: '+.. ... ... ....' },
  { name: 'Ukraine', code: 'UA', dialCode: '380', pattern: '+... .. ... ....' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '971', pattern: '+... .. ... ....' },
  { name: 'United Kingdom', code: 'GB', dialCode: '44', pattern: '+.. .... ......' },
  { name: 'United States', code: 'US', dialCode: '1', pattern: '+. (...) ...-....' },
  { name: 'Vietnam', code: 'VN', dialCode: '84', pattern: '+.. .. ... .. ..' },
]; 