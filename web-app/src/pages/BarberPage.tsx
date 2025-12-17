import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, Award, Scissors, Inbox, Shield } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusManagerBadge } from '../components/CampusManagerBadge';
import { CampusManagerDashboard } from '../components/CampusManagerDashboard';
import { CampusCutsLogo } from '@assets';

export default function BarberPage() {
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showServiceSpecialties, setShowServiceSpecialties] = useState(false);
  const [showPricingDashboard, setShowPricingDashboard] = useState(false);
  const [showCampusManagerDashboard, setShowCampusManagerDashboard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mock barber data - in production this would come from API
  const barberId = 'barber-1';
  const isCampusManager = true; // TODO: Fetch from API
  const campusId = 'campus-1';
  const campusName = 'California Polytechnic State University';
  const campusManagerSince = new Date('2024-01-15'); // TODO: Fetch from API

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Barber Dashboard</h1>
                {/* Campus Manager Badge (conditional) */}
                {isCampusManager && (
                  <CampusManagerBadge 
                    campusName={campusName} 
                    since={campusManagerSince}
                  />
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Booking Requests Inbox */}
              <BarberBookingRequestsDropdown barberId={barberId} />

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-400 rounded-full flex items-center justify-center text-white font-semibold">
                  B
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setShowProfileEditor(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowServiceSpecialties(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Scissors className="w-4 h-4 text-gray-500" />
                    My Services
                  </button>
                  <button
                    onClick={() => {
                      setShowPricingDashboard(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Award className="w-4 h-4 text-gray-500" />
                    Performance & Pricing
                  </button>
                  
                  {/* Campus Manager Option (conditional) */}
                  {isCampusManager && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          setShowCampusManagerDashboard(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                      >
                        <Shield className="w-4 h-4 text-primary-600" />
                        Campus Manager
                      </button>
                    </>
                  )}
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      navigate('/web');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4 text-gray-500" />
                    Back to Roles
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Combined Dashboard & Requests */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <DashboardView navigate={navigate} barberId={barberId} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileEditor(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberProfileEditor barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Service Specialties Modal */}
      {showServiceSpecialties && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowServiceSpecialties(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">My Services & Pricing</h2>
              <button
                onClick={() => setShowServiceSpecialties(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberServiceSpecialties barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Pricing Dashboard Modal */}
      {showPricingDashboard && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPricingDashboard(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Performance & Pricing</h2>
              <button
                onClick={() => setShowPricingDashboard(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberPricingDashboard barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Campus Manager Dashboard Modal (conditional) */}
      {isCampusManager && showCampusManagerDashboard && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCampusManagerDashboard(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                <h2 className="text-xl font-bold text-gray-900">Campus Manager Dashboard</h2>
              </div>
              <button
                onClick={() => setShowCampusManagerDashboard(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <CampusManagerDashboard campusId={campusId} campusName={campusName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
}

function DashboardView({ navigate, barberId }: DashboardViewProps) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowDayModal(false);
        setSelectedDay(null);
      }
    };

    if (showDayModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDayModal]);

  // Mock detailed appointment data by day
  const getAppointmentsForDay = (day: number) => {
    const appointments: { [day: number]: Array<{ time: string; client: string; service: string; price: string; status: string }> } = {
      1: [
        { time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { time: '2:00 PM', client: 'Sarah Miller', service: 'Full Service', price: '$45', status: 'confirmed' },
      ],
      2: [{ time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$23', status: 'confirmed' }],
      3: [{ time: '3:00 PM', client: 'Chris Lee', service: 'Haircut', price: '$28', status: 'pending' }],
      5: [
        { time: '9:00 AM', client: 'David Brown', service: 'Haircut', price: '$28', status: 'confirmed' },
        { time: '10:00 AM', client: 'James Wilson', service: 'Fade', price: '$30', status: 'confirmed' },
        { time: '11:00 AM', client: 'Robert Taylor', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { time: '1:00 PM', client: 'Michael Davis', service: 'Full Service', price: '$45', status: 'confirmed' },
        { time: '2:30 PM', client: 'William Anderson', service: 'Beard Trim', price: '$23', status: 'confirmed' },
        { time: '3:30 PM', client: 'Richard Thomas', service: 'Haircut', price: '$28', status: 'confirmed' },
        { time: '4:30 PM', client: 'Joseph Jackson', service: 'Fade', price: '$30', status: 'confirmed' },
        { time: '5:30 PM', client: 'Thomas White', service: 'Lineup', price: '$15', status: 'confirmed' },
      ],
      12: [
        { time: '10:00 AM', client: 'Edward Evans', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { time: '11:30 AM', client: 'Ronald Edwards', service: 'Beard Trim', price: '$23', status: 'confirmed' },
        { time: '1:00 PM', client: 'Timothy Collins', service: 'Full Service', price: '$45', status: 'pending' },
        { time: '2:30 PM', client: 'Jason Stewart', service: 'Haircut', price: '$28', status: 'confirmed' },
        { time: '4:00 PM', client: 'Jeffrey Morris', service: 'Fade', price: '$30', status: 'confirmed' },
        { time: '5:00 PM', client: 'Ryan Rogers', service: 'Haircut', price: '$28', status: 'confirmed' },
      ],
    };
    return appointments[day] || [];
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setShowDayModal(true);
  };

  return (
    <>
      {/* Schedule Section - Top Priority */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">My Schedule</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setScheduleView('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'daily'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setScheduleView('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'weekly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setScheduleView('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'monthly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Daily View */}
        {scheduleView === 'daily' && (() => {
          const dailyAppointments = [
            { id: '1', time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
            { id: '2', time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$23', status: 'confirmed' },
            { id: '3', time: '2:00 PM', client: 'Chris Lee', service: 'Full Service', price: '$45', status: 'pending' },
            { id: '4', time: '3:30 PM', client: 'David Brown', service: 'Haircut', price: '$28', status: 'confirmed' },
            { id: '5', time: '5:00 PM', client: 'James Wilson', service: 'Haircut', price: '$28', status: 'confirmed' },
          ];

          return (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Today - Friday, January 12, 2025</h3>
                <p className="text-sm text-gray-600">{dailyAppointments.length} appointment{dailyAppointments.length !== 1 ? 's' : ''}</p>
              </div>
              {dailyAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-gray-600">You have no appointments scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyAppointments.map((apt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[80px]">
                          <p className="font-bold text-primary-400">{apt.time}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            apt.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="h-12 w-px bg-gray-300"></div>
                        <div>
                          <p className="font-semibold text-gray-900">{apt.client}</p>
                          <p className="text-sm text-gray-600">{apt.service}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600 mb-1">{apt.price}</p>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => navigate(`/barber/appointment/${apt.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Weekly View */}
        {scheduleView === 'weekly' && (() => {
          // Week appointment data (January 8-14, 2025) - maps to days 8-14 from monthly calendar
          const weekDays = [
            { name: 'Monday', date: 8, shortName: 'Mon' },
            { name: 'Tuesday', date: 9, shortName: 'Tue' },
            { name: 'Wednesday', date: 10, shortName: 'Wed' },
            { name: 'Thursday', date: 11, shortName: 'Thu' },
            { name: 'Friday', date: 12, shortName: 'Fri' },
            { name: 'Saturday', date: 13, shortName: 'Sat' },
            { name: 'Sunday', date: 14, shortName: 'Sun' },
          ];

          const weekAppointmentNames: { [date: number]: string[] } = {
            8: ['Nancy Lee', 'Lisa Walker', 'Betty Hall', 'Margaret Allen', 'Sandra Young', 'Ashley Hernandez', 'Donna King', 'Carol Wright'],
            9: ['Michelle Lopez', 'Emily Hill'],
            10: ['Daniel Scott', 'Matthew Green', 'Anthony Adams', 'Mark Baker'],
            11: ['Donald Nelson', 'Steven Carter', 'Paul Mitchell', 'Andrew Perez', 'Joshua Roberts', 'Kenneth Turner', 'Kevin Phillips', 'Brian Campbell', 'George Parker'],
            12: ['Edward Evans', 'Ronald Edwards', 'Timothy Collins', 'Jason Stewart', 'Jeffrey Morris', 'Ryan Rogers'],
            13: ['Jacob Reed', 'Gary Cook', 'Nicholas Morgan', 'Eric Bell', 'Jonathan Murphy', 'Stephen Bailey', 'Larry Rivera', 'Justin Cooper', 'Scott Richardson'],
            14: ['Brandon Cox', 'Benjamin Howard', 'Samuel Ward', 'Frank Torres'],
          };

          const totalWeekAppointments = Object.values(weekAppointmentNames).reduce((sum, arr) => sum + arr.length, 0);

          return (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Week of January 8 - 14, 2025</h3>
                <p className="text-sm text-gray-600">{totalWeekAppointments} appointments this week</p>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {/* Week day headers */}
                {weekDays.map(day => (
                  <div key={day.date} className="text-center font-semibold text-gray-600 text-sm py-2">
                    {day.shortName}
                  </div>
                ))}
                {/* Week day cards */}
                {weekDays.map(day => {
                  const appointments = weekAppointmentNames[day.date] || [];
                  const isToday = day.date === 12;

                  return (
                    <div
                      key={day.date}
                      onClick={() => handleDayClick(day.date)}
                      className={`p-4 rounded-lg border overflow-hidden min-h-[140px] flex flex-col ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer transition-colors`}
                    >
                      <div className="text-center mb-3">
                        <div className="text-2xl font-bold mb-1">{day.date}</div>
                        <div className={`text-xs ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                          {day.name}
                        </div>
                      </div>
                      <div className="text-xs space-y-1 flex-1 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : (
                          <>
                            <div className="truncate font-medium">{appointments[0]}</div>
                            {appointments.length > 1 && (
                              <>
                                <div className="truncate">{appointments[1]}</div>
                                {appointments.length > 2 && (
                                  <div className={isToday ? 'text-white/80 font-semibold' : 'text-gray-500 font-semibold'}>
                                    +{appointments.length - 2} more
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Monthly View */}
        {scheduleView === 'monthly' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">January 2025</h3>
              <p className="text-sm text-gray-600">168 appointments this month</p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {/* Calendar header */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                  {day}
                </div>
              ))}
              {/* Calendar days */}
              {(() => {
                // Mock appointment data for each day
                const monthAppointments: { [day: number]: string[] } = {
                  1: ['John Doe', 'Sarah Miller'],
                  2: ['Mike Smith'],
                  3: ['Chris Lee'],
                  4: [],
                  5: ['David Brown', 'James Wilson', 'Robert Taylor', 'Michael Davis', 'William Anderson', 'Richard Thomas', 'Joseph Jackson', 'Thomas White'],
                  6: ['Jennifer Harris', 'Linda Martin', 'Patricia Thompson'],
                  7: ['Mary Garcia', 'Barbara Martinez', 'Elizabeth Robinson', 'Susan Clark', 'Jessica Rodriguez', 'Karen Lewis'],
                  8: ['Nancy Lee', 'Lisa Walker', 'Betty Hall', 'Margaret Allen', 'Sandra Young', 'Ashley Hernandez', 'Donna King', 'Carol Wright'],
                  9: ['Michelle Lopez', 'Emily Hill'],
                  10: ['Daniel Scott', 'Matthew Green', 'Anthony Adams', 'Mark Baker'],
                  11: ['Donald Nelson', 'Steven Carter', 'Paul Mitchell', 'Andrew Perez', 'Joshua Roberts', 'Kenneth Turner', 'Kevin Phillips', 'Brian Campbell', 'George Parker'],
                  12: ['Edward Evans', 'Ronald Edwards', 'Timothy Collins', 'Jason Stewart', 'Jeffrey Morris', 'Ryan Rogers'],
                  13: ['Jacob Reed', 'Gary Cook', 'Nicholas Morgan', 'Eric Bell', 'Jonathan Murphy', 'Stephen Bailey', 'Larry Rivera', 'Justin Cooper', 'Scott Richardson'],
                  14: ['Brandon Cox', 'Benjamin Howard', 'Samuel Ward', 'Frank Torres'],
                  15: ['Raymond Peterson', 'Gregory Gray', 'Alexander Ramirez', 'Patrick James', 'Jack Watson', 'Dennis Brooks', 'Jerry Kelly', 'Tyler Sanders', 'Aaron Price'],
                  16: ['Jose Bennett', 'Adam Wood', 'Henry Barnes', 'Nathan Ross', 'Douglas Henderson', 'Zachary Coleman', 'Peter Jenkins', 'Kyle Perry'],
                  17: [],
                  18: ['Walter Powell', 'Ethan Long', 'Jeremy Patterson', 'Harold Hughes', 'Keith Flores', 'Christian Washington'],
                  19: ['Roger Butler', 'Noah Simmons', 'Gerald Foster', 'Carl Gonzales'],
                  20: ['Terry Bryant', 'Sean Alexander', 'Austin Russell', 'Arthur Griffin', 'Lawrence Diaz', 'Jesse Hayes', 'Dylan Myers', 'Bryan Ford', 'Joe Hamilton'],
                  21: ['Jordan Graham'],
                  22: ['Billy Sullivan', 'Albert Wallace', 'Bruce Woods', 'Willie Cole', 'Gabriel West', 'Logan Jordan', 'Alan Owens', 'Juan Reynolds'],
                  23: ['Wayne Fisher', 'Roy Ellis', 'Ralph Gibson', 'Randy Hunt'],
                  24: ['Eugene Crawford', 'Vincent Black', 'Russell Daniels', 'Louis Palmer', 'Philip Mills', 'Bobby Nichols', 'Johnny Grant', 'Bradley Knight', 'Howard Ferguson'],
                  25: ['Shawn Boyd', 'Harry Rose'],
                  26: ['Carlos Stone', 'Jimmy Hawkins', 'Antonio Dunn', 'Bryan Perkins', 'Albert Hudson', 'Jonathan Spencer'],
                  27: ['Craig Gardner', 'Philip Webb', 'Fred Gibson', 'Ernest Walsh', 'Todd Larson', 'Jesse Ramos'],
                  28: ['Eddie Burton', 'Leonard Hicks', 'Danny Crawford', 'Sean Henry', 'Ronnie Boyd', 'Francis Mason', 'Curtis Dixon', 'Tony Fox'],
                  29: ['Vernon Burns', 'Joel Gordon', 'Melvin Wagner'],
                  30: [],
                  31: ['Stanley Fields', 'Leslie Berry'],
                };

                return Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const appointments = monthAppointments[day] || [];
                  
                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`aspect-square p-2 rounded-lg border overflow-hidden ${
                        day === 12 
                          ? 'bg-primary-400 text-white border-primary-500' 
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer transition-colors`}
                    >
                      <div className="text-sm font-semibold mb-1">{day}</div>
                      <div className="text-xs space-y-0.5 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className="text-gray-400">No apts</div>
                        ) : appointments.length === 1 ? (
                          <div className="truncate">{appointments[0]}</div>
                        ) : (
                          <>
                            <div className="truncate">{appointments[0]}</div>
                            <div className={day === 12 ? 'text-white/80' : 'text-gray-500'}>
                              +{appointments.length - 1} more
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </Card>

      {/* Day Detail Modal */}
      {showDayModal && selectedDay !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-primary-400 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">January {selectedDay}, 2025</h2>
                  <p className="text-white/80">
                    {getAppointmentsForDay(selectedDay).length} appointment{getAppointmentsForDay(selectedDay).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDayModal(false);
                    setSelectedDay(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {getAppointmentsForDay(selectedDay).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-gray-600">You have no appointments scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAppointmentsForDay(selectedDay).map((apt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[80px]">
                          <p className="font-bold text-primary-400">{apt.time}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            apt.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="h-12 w-px bg-gray-300"></div>
                        <div>
                          <p className="font-semibold text-gray-900">{apt.client}</p>
                          <p className="text-sm text-gray-600">{apt.service}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600 mb-1">{apt.price}</p>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => {
                            setShowDayModal(false);
                            navigate(`/barber/appointment/${apt.time}`);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
