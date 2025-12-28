import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  ChevronDown,
  User, 
  Scissors, 
  CreditCard, 
  Calendar, 
  Shield,
  Mail,
  Smartphone,
  HelpCircle,
  FileText,
  Globe,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import FooterChairLogo from '../../assets/logos/Footer_Chair.webp';
import HeaderChairLogo from '../../assets/logos/Header_Chair.webp';

interface FAQItem {
  question: string;
  answer: string;
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  items: FAQItem[];
}

function AccordionItem({ question, answer, isOpen, onClick }: { 
  question: string; 
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
          isOpen ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
        }`}
      >
        <span className="font-medium text-gray-900 pr-4">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed bg-gray-50">
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('getting-started');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const categories: Category[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'New to CampusCut? Start here.',
      icon: <Smartphone className="w-5 h-5" />,
      color: 'bg-blue-500',
      items: [
        {
          question: 'How do I create an account?',
          answer: 'Click "Get Started" on the homepage, then sign up with your email address. You will need to verify your email to complete registration. Both consumers and barbers can create accounts.'
        },
        {
          question: 'What is the difference between a Consumer and a Barber account?',
          answer: 'Consumer accounts are for people looking to book haircuts. Barber accounts are for service providers who want to offer their grooming services. You can choose your account type during registration.'
        },
        {
          question: 'How do I install CampusCut as an app?',
          answer: 'CampusCut is a Progressive Web App (PWA). On iOS, open the site in Safari, tap the Share button, and select "Add to Home Screen." On Android, tap the three-dot menu in Chrome and select "Add to Home screen" or "Install app."'
        },
        {
          question: 'Is CampusCut free to use?',
          answer: 'Yes! Creating an account and browsing is completely free. Consumers only pay for the services they book.'
        }
      ]
    },
    {
      id: 'booking',
      title: 'Booking',
      description: 'Schedule and manage appointments.',
      icon: <Calendar className="w-5 h-5" />,
      color: 'bg-green-500',
      items: [
        {
          question: 'How do I book a haircut?',
          answer: 'Browse available barbers, view their profiles and reviews, then tap "Book Now." Select your preferred service, date, time, and location. The barber will review and confirm your request.'
        },
        {
          question: 'Can I cancel or reschedule my booking?',
          answer: 'Yes, you can cancel or reschedule before the barber marks the service as complete. Go to your bookings, select the appointment, and choose Cancel or Reschedule. Please provide as much notice as possible.'
        },
        {
          question: 'What if the barber does not show up?',
          answer: 'If a barber fails to show up for a confirmed appointment, contact us immediately at campuscuthelp@gmail.com. We will investigate and issue a refund if appropriate.'
        },
        {
          question: 'Where do haircuts take place?',
          answer: 'Locations are agreed upon between you and the barber during booking. Common locations include campus dorms, apartments, or other mutually convenient spots.'
        }
      ]
    },
    {
      id: 'payments',
      title: 'Payments',
      description: 'Pricing, payments, and refunds.',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'bg-purple-500',
      items: [
        {
          question: 'How do I pay for services?',
          answer: 'All payments are processed securely through the app using Stripe. You can pay with credit card, debit card, or other supported payment methods. No cash is needed.'
        },
        {
          question: 'When am I charged for a booking?',
          answer: 'Your payment method is authorized when you book. The payment is only captured and released to the barber after they mark the service as complete.'
        },
        {
          question: 'How do refunds work?',
          answer: 'If you cancel before the service is completed, your payment will be refunded. Refund timing depends on your payment method but typically takes 5-10 business days.'
        },
        {
          question: 'Is my payment information secure?',
          answer: 'Yes. We use Stripe, a PCI-DSS compliant payment processor. Your full card details are never stored on our servers. All transactions are encrypted.'
        },
        {
          question: 'How are payments processed?',
          answer: 'Payments are processed securely through Stripe. Funds are held in escrow until service completion, then released to the barber.'
        }
      ]
    },
    {
      id: 'for-barbers',
      title: 'For Barbers',
      description: 'Earn money on your schedule.',
      icon: <Scissors className="w-5 h-5" />,
      color: 'bg-primary-500',
      items: [
        {
          question: 'How do I become a barber on CampusCut?',
          answer: 'Sign up and select "Barber" as your account type. Complete your profile with your services, pricing, availability, and portfolio images. Once set up, you can start receiving booking requests.'
        },
        {
          question: 'How much do I earn per cut?',
          answer: 'You keep the majority of every payment, which is significantly better than traditional barbershop commissions (40-60%).'
        },
        {
          question: 'When do I get paid?',
          answer: 'Payments are released instantly after you mark a booking as complete. Funds are transferred to your connected payout method.'
        },
        {
          question: 'Can I set my own prices?',
          answer: 'Absolutely! You have full control over your service menu and pricing. Set prices that reflect your skills and the value you provide.'
        },
        {
          question: 'Can I decline booking requests?',
          answer: 'Yes. You review each booking request and can accept, decline, or suggest alternative times. You choose which customers to work with.'
        }
      ]
    },
    {
      id: 'reviews',
      title: 'Reviews',
      description: 'Feedback and reputation.',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'bg-amber-500',
      items: [
        {
          question: 'How do reviews work?',
          answer: 'After a completed booking, consumers can leave a review and rating for the barber. Reviews help build reputation and help other users make informed decisions.'
        },
        {
          question: 'Can I edit or delete my review?',
          answer: 'You can edit your review within 24 hours of posting. After that, reviews are permanent to ensure authenticity.'
        },
        {
          question: 'What are reliability scores?',
          answer: 'Both consumers and barbers have reliability scores based on their booking history. Factors include showing up on time, cancellation rate, and overall conduct.'
        },
        {
          question: 'How do I report a fake or abusive review?',
          answer: 'Contact us at campuscuthelp@gmail.com with the review details. We investigate all reports and take action against policy violations.'
        }
      ]
    },
    {
      id: 'safety',
      title: 'Safety',
      description: 'Trust and community guidelines.',
      icon: <Shield className="w-5 h-5" />,
      color: 'bg-red-500',
      items: [
        {
          question: 'How does CampusCut ensure safety?',
          answer: 'We verify user accounts, maintain review systems, track reliability scores, and have a zero-tolerance policy for harassment or abuse.'
        },
        {
          question: 'What is the zero-tolerance policy?',
          answer: 'CampusCut has zero tolerance for harassment, discrimination, objectionable content, or abusive behavior. Violations result in immediate account suspension.'
        },
        {
          question: 'How do I report a problem?',
          answer: 'Email us at campuscuthelp@gmail.com with details of the issue. For urgent safety concerns, contact local authorities first, then notify us.'
        },
        {
          question: 'What if I have a dispute with a barber or customer?',
          answer: 'First, try to resolve the issue directly through messaging. If you cannot reach a resolution, contact us with booking details and we will help mediate.'
        }
      ]
    }
  ];

  const activeCategoryData = categories.find(c => c.id === activeCategory);

  // Filter items based on search
  const getFilteredItems = () => {
    if (!searchQuery) return activeCategoryData?.items || [];
    
    const allItems: { category: string; item: FAQItem }[] = [];
    categories.forEach(cat => {
      cat.items.forEach(item => {
        if (
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          allItems.push({ category: cat.title, item });
        }
      });
    });
    return allItems;
  };

  const filteredItems = getFilteredItems();
  const isSearching = searchQuery.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={FooterChairLogo} alt="CampusCut" className="h-10 w-auto" />
            <span className="text-xl font-bold">Help Center</span>
          </Link>
          <Link 
            to="/"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to CampusCut
          </Link>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-gray-900 text-white pb-12 pt-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-6">How can we help you?</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white text-gray-900 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-400 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Topics
            </h3>
            <nav className="space-y-1">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeCategory === category.id && !isSearching
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={`${category.color} text-white p-1.5 rounded-md`}>
                    {category.icon}
                  </span>
                  <span className="font-medium text-sm">{category.title}</span>
                </button>
              ))}
            </nav>

            {/* Quick Links */}
            <div className="mt-10 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Legal
              </h3>
              <div className="space-y-2">
                <Link 
                  to="/terms" 
                  className="flex items-center gap-2 text-gray-600 hover:text-primary-500 text-sm transition-colors"
                >
                  <FileText size={16} />
                  Terms of Service
                </Link>
                <Link 
                  to="/privacy" 
                  className="flex items-center gap-2 text-gray-600 hover:text-primary-500 text-sm transition-colors"
                >
                  <Shield size={16} />
                  Privacy Policy
                </Link>
                <Link 
                  to="/gdpr" 
                  className="flex items-center gap-2 text-gray-600 hover:text-primary-500 text-sm transition-colors"
                >
                  <Globe size={16} />
                  GDPR
                </Link>
              </div>
            </div>
          </div>

          {/* FAQ Content */}
          <div className="flex-1 min-w-0">
            {isSearching ? (
              // Search Results
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Search Results
                </h2>
                <p className="text-gray-500 mb-6">
                  {(filteredItems as { category: string; item: FAQItem }[]).length} results for "{searchQuery}"
                </p>

                {(filteredItems as { category: string; item: FAQItem }[]).length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-500 mb-4">Try different keywords or browse topics on the left.</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-primary-500 hover:text-primary-600 font-medium"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(filteredItems as { category: string; item: FAQItem }[]).map((result, index) => (
                      <AccordionItem
                        key={index}
                        question={result.item.question}
                        answer={result.item.answer}
                        isOpen={openItems[`search-${index}`] || false}
                        onClick={() => toggleItem(`search-${index}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Category View
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className={`${activeCategoryData?.color} text-white p-2 rounded-lg`}>
                    {activeCategoryData?.icon}
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{activeCategoryData?.title}</h2>
                    <p className="text-gray-500 text-sm">{activeCategoryData?.description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {(filteredItems as FAQItem[]).map((item, index) => (
                    <AccordionItem
                      key={index}
                      question={item.question}
                      answer={item.answer}
                      isOpen={openItems[`${activeCategory}-${index}`] || false}
                      onClick={() => toggleItem(`${activeCategory}-${index}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Contact Box */}
            <div className="mt-10 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-primary-500 p-3 rounded-full">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h3 className="font-bold text-lg">Still have questions?</h3>
                  <p className="text-gray-300 text-sm">Our team is ready to help.</p>
                </div>
                <a
                  href="mailto:campuscuthelp@gmail.com"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  Contact Support
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={HeaderChairLogo} alt="CampusCut" className="h-8 w-auto" />
            <span className="font-semibold text-gray-900">CampusCut</span>
          </Link>
          <p className="text-gray-500 text-sm">© 2025 CampusCut. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
