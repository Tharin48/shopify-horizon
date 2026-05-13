#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const METAOBJECT_TYPE = 'shipping_country';
const API_VERSION = 'latest';

const shippingCountries = [
  {
    country_name: 'Sri Lanka',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 48
  },
  {
    country_name: 'Algeria',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 1
  },
  {
    country_name: 'Australia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 2
  },
  {
    country_name: 'Austria',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 3
  },
  {
    country_name: 'Bahrain',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 4
  },
  {
    country_name: 'Belgium',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 5
  },
  {
    country_name: 'Botswana',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 6
  },
  {
    country_name: 'Canada',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 7
  },
  {
    country_name: 'Costa Rica',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 8
  },
  {
    country_name: 'Czech Republic',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 9
  },
  {
    country_name: 'Denmark',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 10
  },
  {
    country_name: 'Egypt',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 11
  },
  {
    country_name: 'El Salvador',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 12
  },
  {
    country_name: 'Estonia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 13
  },
  {
    country_name: 'Finland',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 14
  },
  {
    country_name: 'France',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 15
  },
  {
    country_name: 'Germany',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 16
  },
  {
    country_name: 'Guatemala',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 17
  },
  {
    country_name: 'Hong Kong',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 18
  },
  {
    country_name: 'Hungary',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 19
  },
  {
    country_name: 'Indonesia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 20
  },
  {
    country_name: 'Ireland',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 21
  },
  {
    country_name: 'Israel',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 22
  },
  {
    country_name: 'Japan',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 23
  },
  {
    country_name: 'Kuwait',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 24
  },
  {
    country_name: 'Lebanon',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 25
  },
  {
    country_name: 'Malaysia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 26
  },
  {
    country_name: 'Mexico',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 27
  },
  {
    country_name: 'Mongolia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 28
  },
  {
    country_name: 'Montenegro',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 29
  },
  {
    country_name: 'Morocco',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 30
  },
  {
    country_name: 'Netherlands',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 31
  },
  {
    country_name: 'New Zealand',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 32
  },
  {
    country_name: 'Nigeria',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 33
  },
  {
    country_name: 'Norway',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 34
  },
  {
    country_name: 'Oman',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 35
  },
  {
    country_name: 'Pakistan',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 36
  },
  {
    country_name: 'Philippines',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 37
  },
  {
    country_name: 'Poland',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 38
  },
  {
    country_name: 'Qatar',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 39
  },
  {
    country_name: 'Romania',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 40
  },
  {
    country_name: 'Samoa',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 41
  },
  {
    country_name: 'Saudi Arabia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 42
  },
  {
    country_name: 'Serbia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 43
  },
  {
    country_name: 'Singapore',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 44
  },
  {
    country_name: 'Slovenia',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 45
  },
  {
    country_name: 'South Africa',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 46
  },
  {
    country_name: 'South Korea',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 47
  },
  {
    country_name: 'Sweden',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 49
  },
  {
    country_name: 'Switzerland',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 50
  },
  {
    country_name: 'United States of America',
    shipping_status: 'eligible',
    shipping_group: 'often_shipped',
    notice: 'Shipping is available. Free shipping for orders over $49. Local customs duties/taxes are not included and may apply.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 51
  },
  {
    country_name: 'Afghanistan',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 52
  },
  {
    country_name: 'Albania',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 53
  },
  {
    country_name: 'American Samoa',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 54
  },
  {
    country_name: 'Andorra',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 55
  },
  {
    country_name: 'Angola',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 56
  },
  {
    country_name: 'Anguilla',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 57
  },
  {
    country_name: 'Antigua',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 58
  },
  {
    country_name: 'Aruba',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 59
  },
  {
    country_name: 'Bahamas',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 60
  },
  {
    country_name: 'Bangladesh',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 61
  },
  {
    country_name: 'Barbados',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 62
  },
  {
    country_name: 'Barbuda',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 63
  },
  {
    country_name: 'Belize',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 64
  },
  {
    country_name: 'Benin',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 65
  },
  {
    country_name: 'Bermuda',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 66
  },
  {
    country_name: 'Bhutan',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 67
  },
  {
    country_name: 'Bolivia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 68
  },
  {
    country_name: 'Bonaire',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 69
  },
  {
    country_name: 'Bosnia-Herzegovina',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 70
  },
  {
    country_name: 'British Virgin Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 71
  },
  {
    country_name: 'Brunei',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 72
  },
  {
    country_name: 'Bulgaria',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 73
  },
  {
    country_name: 'Burkina Faso',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 74
  },
  {
    country_name: 'Burundi',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 75
  },
  {
    country_name: 'Cambodia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 76
  },
  {
    country_name: 'Cameroon',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 77
  },
  {
    country_name: 'Canary Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 78
  },
  {
    country_name: 'Cape Verde',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 79
  },
  {
    country_name: 'Cayman Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 80
  },
  {
    country_name: 'Chile',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: 'Requires RUT/TAX ID Number.',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 81
  },
  {
    country_name: 'Chad',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 82
  },
  {
    country_name: 'Channel Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 83
  },
  {
    country_name: 'Colombia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 84
  },
  {
    country_name: 'Congo',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 85
  },
  {
    country_name: 'Congo, Dem Rep Of',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 86
  },
  {
    country_name: 'Cook Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 87
  },
  {
    country_name: "Cote d'Ivoire",
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 88
  },
  {
    country_name: 'Croatia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 89
  },
  {
    country_name: 'Curacao',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 90
  },
  {
    country_name: 'Cyprus',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 91
  },
  {
    country_name: 'Djibouti',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 92
  },
  {
    country_name: 'Dominica',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 93
  },
  {
    country_name: 'Dominican Republic',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 94
  },
  {
    country_name: 'East Timor',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 95
  },
  {
    country_name: 'Ecuador',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 96
  },
  {
    country_name: 'Eritrea',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 97
  },
  {
    country_name: 'Ethiopia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 98
  },
  {
    country_name: 'Faeroe Islands',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 99
  },
  {
    country_name: 'Fiji',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 100
  },
  {
    country_name: 'French Guiana',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 101
  },
  {
    country_name: 'French Polynesia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 102
  },
  {
    country_name: 'Gabon',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 103
  },
  {
    country_name: 'Gambia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 104
  },
  {
    country_name: 'Ghana',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 105
  },
  {
    country_name: 'Gibraltar',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 106
  },
  {
    country_name: 'Greenland',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 107
  },
  {
    country_name: 'Grenada',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 108
  },
  {
    country_name: 'Guadeloupe',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 109
  },
  {
    country_name: 'Guinea',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 110
  },
  {
    country_name: 'Guyana',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 111
  },
  {
    country_name: 'Haiti',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 112
  },
  {
    country_name: 'Honduras',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 113
  },
  {
    country_name: 'Iceland',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 114
  },
  {
    country_name: 'India',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: 'Requires KYC & Clearance Authority Letter.',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 115
  },
  {
    country_name: 'Iraq',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 116
  },
  {
    country_name: 'Jamaica',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 117
  },
  {
    country_name: 'Jordan',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 118
  },
  {
    country_name: 'Kenya',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 119
  },
  {
    country_name: 'Laos',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 120
  },
  {
    country_name: 'Latvia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 121
  },
  {
    country_name: 'Lesotho',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 122
  },
  {
    country_name: 'Liberia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 123
  },
  {
    country_name: 'Libya',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 124
  },
  {
    country_name: 'Liechtenstein',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 125
  },
  {
    country_name: 'Luxembourg',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 126
  },
  {
    country_name: 'Macau',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 127
  },
  {
    country_name: 'Macedonia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 128
  },
  {
    country_name: 'Madagascar',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 129
  },
  {
    country_name: 'Malawi',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 130
  },
  {
    country_name: 'Maldives',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 131
  },
  {
    country_name: 'Mali',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 132
  },
  {
    country_name: 'Malta',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 133
  },
  {
    country_name: 'Mauritius',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 134
  },
  {
    country_name: 'Monaco',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 135
  },
  {
    country_name: 'Mozambique',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 136
  },
  {
    country_name: 'Namibia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 137
  },
  {
    country_name: 'Nepal',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 138
  },
  {
    country_name: 'New Caledonia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 139
  },
  {
    country_name: 'Nicaragua',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 140
  },
  {
    country_name: 'Niger',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 141
  },
  {
    country_name: 'Panama',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 142
  },
  {
    country_name: 'Papua New Guinea',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 143
  },
  {
    country_name: 'Paraguay',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 144
  },
  {
    country_name: 'Peru',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 145
  },
  {
    country_name: 'Portugal',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 146
  },
  {
    country_name: 'Puerto Rico',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 147
  },
  {
    country_name: 'Reunion',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 148
  },
  {
    country_name: 'Rwanda',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 149
  },
  {
    country_name: 'San Marino',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 150
  },
  {
    country_name: 'Senegal',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 151
  },
  {
    country_name: 'Seychelles',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 152
  },
  {
    country_name: 'Slovak Republic',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 153
  },
  {
    country_name: 'Suriname',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 154
  },
  {
    country_name: 'Swaziland',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 155
  },
  {
    country_name: 'Taiwan',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 156
  },
  {
    country_name: 'Tanzania',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 157
  },
  {
    country_name: 'Tunisia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 158
  },
  {
    country_name: 'Uganda',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 159
  },
  {
    country_name: 'Vatican City',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 160
  },
  {
    country_name: 'Venezuela',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 161
  },
  {
    country_name: 'Vietnam',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 162
  },
  {
    country_name: 'Zambia',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 163
  },
  {
    country_name: 'Zimbabwe',
    shipping_status: 'eligible_with_conditions',
    shipping_group: 'courier_partner',
    notice: 'Shipping available via courier partners. Additional documents may be required by local authorities. Free shipping applies above $49 but duties/taxes are not included.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 164
  },
  {
    country_name: 'Armenia',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 165
  },
  {
    country_name: 'Argentina',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 166
  },
  {
    country_name: 'Azerbaijan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 167
  },
  {
    country_name: 'Belarus',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 168
  },
  {
    country_name: 'Brazil',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 169
  },
  {
    country_name: 'Georgia',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 170
  },
  {
    country_name: 'Greece',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 171
  },
  {
    country_name: 'Kazakhstan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 172
  },
  {
    country_name: 'Kyrgyzstan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 173
  },
  {
    country_name: 'Moldova',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 174
  },
  {
    country_name: 'Russia',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 175
  },
  {
    country_name: 'Spain',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: 'Restricted for food items via courier.',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 176
  },
  {
    country_name: 'Tajikistan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 177
  },
  {
    country_name: 'Turkey',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 178
  },
  {
    country_name: 'Turkmenistan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 179
  },
  {
    country_name: 'Ukraine',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 180
  },
  {
    country_name: 'Uzbekistan',
    shipping_status: 'special_import_license_required',
    shipping_group: 'special_import_license',
    notice: 'This country may require a special import license or has restrictions on tea imports. Please contact orders@dilmahtea.com before placing your order.',
    required_documents: '',
    contact_email: 'orders@dilmahtea.com',
    enabled: true,
    sort_order: 181
  }
].sort((left, right) => left.sort_order - right.sort_order);

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeStore(store) {
  return store
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function normalizeCountryName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase();
}

function createHandle(countryName) {
  return String(countryName || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function toFieldValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return value == null ? '' : String(value);
}

async function graphqlRequest({ store, token, query, variables }) {
  const response = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GraphQL HTTP ${response.status}: ${body}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

async function fetchExistingCountryNames({ store, token }) {
  const query = `
    query ExistingShippingCountries($type: String!, $cursor: String) {
      metaobjects(type: $type, first: 100, after: $cursor) {
        nodes {
          handle
          countryName: field(key: "country_name") {
            value
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const existing = new Set();
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await graphqlRequest({
      store,
      token,
      query,
      variables: {
        type: METAOBJECT_TYPE,
        cursor
      }
    });

    const connection = data.metaobjects;

    for (const node of connection.nodes) {
      const countryName = node.countryName && node.countryName.value;
      if (!countryName) continue;
      existing.add(normalizeCountryName(countryName));
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return existing;
}

async function createMetaobject({ store, token, item }) {
  const mutation = `
    mutation CreateShippingCountry($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const fields = [
    { key: 'country_name', value: toFieldValue(item.country_name) },
    { key: 'shipping_status', value: toFieldValue(item.shipping_status) },
    { key: 'shipping_group', value: toFieldValue(item.shipping_group) },
    { key: 'notice', value: toFieldValue(item.notice) },
    { key: 'required_documents', value: toFieldValue(item.required_documents) },
    { key: 'contact_email', value: toFieldValue(item.contact_email) },
    { key: 'enabled', value: toFieldValue(item.enabled) },
    { key: 'sort_order', value: toFieldValue(item.sort_order) }
  ];

  return graphqlRequest({
    store,
    token,
    query: mutation,
    variables: {
      metaobject: {
        type: METAOBJECT_TYPE,
        handle: createHandle(item.country_name),
        fields
      }
    }
  });
}

function validateItem(item, index) {
  const requiredKeys = [
    'country_name',
    'shipping_status',
    'shipping_group',
    'notice',
    'required_documents',
    'contact_email',
    'enabled',
    'sort_order'
  ];

  for (const key of requiredKeys) {
    if (!(key in item)) {
      throw new Error(`Item at index ${index} is missing required key "${key}"`);
    }
  }
}

async function main() {
  loadDotEnv();

  const store = normalizeStore(requireEnv('SHOPIFY_STORE'));
  const token = requireEnv('SHOPIFY_ADMIN_TOKEN');

  if (!Array.isArray(shippingCountries) || shippingCountries.length === 0) {
    console.log('No shipping country records found in import.js. Nothing to import.');
    return;
  }

  shippingCountries.forEach(validateItem);

  const existingCountryNames = await fetchExistingCountryNames({ store, token });
  const queuedCountryNames = new Set();

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of shippingCountries) {
    const countryKey = normalizeCountryName(item.country_name);

    if (!countryKey) {
      failedCount += 1;
      console.error(`[FAIL] Missing country_name: ${JSON.stringify(item)}`);
      continue;
    }

    if (existingCountryNames.has(countryKey) || queuedCountryNames.has(countryKey)) {
      skippedCount += 1;
      console.log(`[SKIP] Duplicate country_name "${item.country_name}"`);
      continue;
    }

    try {
      const data = await createMetaobject({ store, token, item });
      const payload = data.metaobjectCreate;

      if (payload.userErrors && payload.userErrors.length > 0) {
        failedCount += 1;
        console.error(
          `[FAIL] ${item.country_name}: ${payload.userErrors
            .map((error) => error.message)
            .join('; ')}`
        );
        continue;
      }

      successCount += 1;
      existingCountryNames.add(countryKey);
      queuedCountryNames.add(countryKey);
      console.log(
        `[OK] ${item.country_name} -> handle "${payload.metaobject.handle}"`
      );
    } catch (error) {
      failedCount += 1;
      console.error(`[FAIL] ${item.country_name}: ${error.message}`);
    }
  }

  console.log('\nImport complete');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exitCode = 1;
});
