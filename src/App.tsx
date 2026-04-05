/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from './store';
import { generatePDF } from './lib/pdf';
import { parseExcelFile, parsePDFFile } from './lib/importUtils';
import { formatSafeDate } from './lib/utils';
import { format } from 'date-fns';
import { 
  Search, Plus, Download, Trash2, CheckCircle, 
  XCircle, Menu, X, FileText, LayoutDashboard,
  ArrowUpDown, ArrowUp, ArrowDown, Upload, Pencil
} from 'lucide-react';
import { Reservation } from './types';

export default function App() {
  const { 
    reservations, payments, operators, addReservation, batchAddReservations,
    updateReservation, deleteReservation, batchDeleteReservations, togglePaidStatus, addOperator, deleteOperator,
    addPayment, deletePayment, isLoaded 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<string>('RESUMEN');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [showNewOperatorModal, setShowNewOperatorModal] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // Payment form state
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Clear selection when changing tabs or searching
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, searchTerm]);

  // Form state
  const [formData, setFormData] = useState({
    operator: '',
    phNemo: '',
    localizador: '',
    siti: '',
    apellido: '',
    limitePago: '',
    agente: '',
    valorNeto: ''
  });

  if (!isLoaded) return <div className="flex items-center justify-center h-screen">Cargando...</div>;

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const reservationData = {
      operator: formData.operator || activeTab,
      phNemo: formData.phNemo,
      localizador: formData.localizador,
      siti: formData.siti,
      apellido: formData.apellido,
      limitePago: formData.limitePago,
      agente: formData.agente,
      valorNeto: parseFloat(formData.valorNeto),
      isPaid: false
    };

    if (editingReservationId) {
      updateReservation(editingReservationId, reservationData);
    } else {
      addReservation(reservationData);
    }
    
    setShowAddModal(false);
    setEditingReservationId(null);
    setFormData({
      operator: '', phNemo: '', localizador: '', siti: '', 
      apellido: '', limitePago: '', agente: '', valorNeto: ''
    });
  };

  const handleEditClick = (res: Reservation) => {
    setFormData({
      operator: res.operator,
      phNemo: res.phNemo,
      localizador: res.localizador,
      siti: res.siti,
      apellido: res.apellido,
      limitePago: res.limitePago,
      agente: res.agente,
      valorNeto: res.valorNeto.toString()
    });
    setEditingReservationId(res.id);
    setShowAddModal(true);
  };

  const handleAddOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOperatorName.trim()) {
      addOperator(newOperatorName.trim());
      setNewOperatorName('');
      setShowNewOperatorModal(false);
    }
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDescription.trim() || !paymentAmount) return;
    
    addPayment({
      operator: activeTab,
      description: paymentDescription,
      amount: parseFloat(paymentAmount)
    });
    
    setPaymentDescription('');
    setPaymentAmount('');
  };

  // Filter reservations based on active tab and search term
  let filteredReservations = reservations;
  
  if (activeTab === 'RESUMEN') {
    filteredReservations = reservations.filter(r => r.operator !== 'EURORUTAS');
  } else {
    filteredReservations = reservations.filter(r => r.operator === activeTab);
  }

  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredReservations = filteredReservations.filter(r => 
      r.phNemo.toLowerCase().includes(lowerSearch) ||
      r.localizador.toLowerCase().includes(lowerSearch) ||
      r.siti.toLowerCase().includes(lowerSearch) ||
      r.apellido.toLowerCase().includes(lowerSearch) ||
      r.limitePago.toLowerCase().includes(lowerSearch) ||
      r.agente.toLowerCase().includes(lowerSearch)
    );
  }

  // Sort by limitePago
  filteredReservations.sort((a, b) => {
    const timeA = new Date(a.limitePago).getTime();
    const timeB = new Date(b.limitePago).getTime();
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  // Calculate financial summary for the current operator
  const saldoAPagar = filteredReservations.reduce((sum, res) => sum + res.valorNeto, 0);
  const operatorPayments = activeTab === 'RESUMEN' 
    ? payments.filter(p => p.operator !== 'EURORUTAS')
    : payments.filter(p => p.operator === activeTab);
  const saldoEnCuentaInvertido = operatorPayments.reduce((sum, p) => sum + p.amount, 0);
  const estadoDeCuenta = saldoAPagar - saldoEnCuentaInvertido;

  const handleExportPDF = () => {
    const title = activeTab === 'RESUMEN' ? 'Resumen General (Sin Eurorutas)' : `Reservas - ${activeTab}`;
    generatePDF(title, filteredReservations);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredReservations.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeTab === 'RESUMEN') {
      alert('Por favor, selecciona un operador específico en el menú lateral antes de importar un archivo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    try {
      let parsedData: any[] = [];
      const fileType = file.name.split('.').pop()?.toLowerCase();

      if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
        parsedData = await parseExcelFile(file, activeTab);
      } else if (fileType === 'pdf') {
        parsedData = await parsePDFFile(file, activeTab);
      } else {
        throw new Error('Formato de archivo no soportado. Por favor, usa .xlsx, .xls, .csv o .pdf');
      }

      if (parsedData.length > 0) {
        await batchAddReservations(parsedData);
        alert(`¡Éxito! Se han importado ${parsedData.length} reservas correctamente.`);
      } else {
        alert('No se encontraron reservas válidas en el archivo.');
      }
    } catch (error: any) {
      console.error('Error importing file:', error);
      alert(`Error al importar: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950">
          <h1 className="text-xl font-bold text-white tracking-tight">TurismoAdmin</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <div className="space-y-1">
            <button
              onClick={() => { setActiveTab('RESUMEN'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'RESUMEN' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} />
              Resumen General
            </button>
          </div>

          <div className="mt-8 mb-4 px-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operadores</h2>
          </div>
          
          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-250px)]">
            {operators.map(op => (
              <div key={op} className="group relative flex items-center">
                <button
                  onClick={() => { setActiveTab(op); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === op ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileText size={16} />
                  <span className="truncate pr-6">{op}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOperatorToDelete(op);
                  }}
                  className="absolute right-2 p-1.5 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-slate-800"
                  title="Eliminar operador"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 px-4">
            <button
              onClick={() => setShowNewOperatorModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Plus size={16} />
              Nuevo Operador
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">
              {activeTab === 'RESUMEN' ? 'Resumen General' : `Operador: ${activeTab}`}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Eliminar ({selectedIds.size})</span>
              </button>
            )}
            {activeTab !== 'RESUMEN' && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Importar Excel o PDF"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">{isImporting ? 'Importando...' : 'Importar'}</span>
                </button>
              </>
            )}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, operator: activeTab === 'RESUMEN' ? operators[0] : activeTab }));
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nueva Reserva</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {/* Search Bar */}
          <div className="mb-6 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por PH Nemo, Localizador, Pasajero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
            />
          </div>

          {/* Table */}
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={filteredReservations.length > 0 && selectedIds.size === filteredReservations.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    {activeTab === 'RESUMEN' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operador</th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PH Nemo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localizador</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SITI</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pasajero</th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                      <div className="flex items-center gap-1">
                        Límite Pago
                        <span className="text-gray-400 group-hover:text-gray-600">
                          {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </span>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Neto</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'RESUMEN' ? 11 : 10} className="px-6 py-12 text-center text-gray-500">
                        No se encontraron reservas.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((res) => (
                      <tr key={res.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(res.id) ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.has(res.id)}
                            onChange={() => handleSelectOne(res.id)}
                          />
                        </td>
                        {activeTab === 'RESUMEN' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{res.operator}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{res.phNemo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{res.localizador}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{res.siti}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{res.apellido}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatSafeDate(res.limitePago)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{res.agente}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${res.valorNeto.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => togglePaidStatus(res.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              res.isPaid 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            {res.isPaid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {res.isPaid ? 'Abonada' : 'Pendiente'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(res)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Editar reserva"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => setReservationToDelete(res.id)}
                              className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Eliminar reserva"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary & Payments Section */}
          {activeTab !== 'RESUMEN' ? (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left side: Payments input and list */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pagos / Tickets Pendientes</h3>
                
                <form onSubmit={handleAddPayment} className="flex flex-col sm:flex-row gap-3 mb-6">
                  <input
                    type="text"
                    required
                    placeholder="Descripción del pago o ticket..."
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="relative w-full sm:w-48">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Monto"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors whitespace-nowrap"
                  >
                    Añadir Pago
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {operatorPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                            No hay pagos registrados para este operador.
                          </td>
                        </tr>
                      ) : (
                        operatorPayments.map(payment => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {format(new Date(payment.createdAt), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{payment.description}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              ${payment.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deletePayment(payment.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                title="Eliminar pago"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right side: Summary boxes */}
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-yellow-800 uppercase tracking-wider mb-1">Saldo a Pagar</h4>
                  <p className="text-3xl font-bold text-yellow-900">${saldoAPagar.toFixed(2)}</p>
                  <p className="text-xs text-yellow-700 mt-1">Sumatoria de valores netos</p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wider mb-1">Saldo en Cuenta Invertido</h4>
                  <p className="text-3xl font-bold text-green-900">${saldoEnCuentaInvertido.toFixed(2)}</p>
                  <p className="text-xs text-green-700 mt-1">Pagos y tickets pendientes</p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-1">Estado de Cuenta</h4>
                  <p className="text-3xl font-bold text-red-900">${estadoDeCuenta.toFixed(2)}</p>
                  <p className="text-xs text-red-700 mt-1">Saldo a Pagar - Saldo Invertido</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-yellow-800 uppercase tracking-wider mb-1">Saldo a Pagar Total</h4>
                <p className="text-3xl font-bold text-yellow-900">${saldoAPagar.toFixed(2)}</p>
                <p className="text-xs text-yellow-700 mt-1">Sumatoria total (sin Eurorutas)</p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wider mb-1">Saldo Invertido Total</h4>
                <p className="text-3xl font-bold text-green-900">${saldoEnCuentaInvertido.toFixed(2)}</p>
                <p className="text-xs text-green-700 mt-1">Pagos totales (sin Eurorutas)</p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-1">Estado General Total</h4>
                <p className="text-3xl font-bold text-red-900">${estadoDeCuenta.toFixed(2)}</p>
                <p className="text-xs text-red-700 mt-1">Saldo a Pagar - Saldo Invertido</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingReservationId ? 'Editar Reserva' : 'Nueva Reserva'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingReservationId(null);
                  setFormData({
                    operator: '', phNemo: '', localizador: '', siti: '', 
                    apellido: '', limitePago: '', agente: '', valorNeto: ''
                  });
                }} 
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddReservation} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {activeTab === 'RESUMEN' && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
                    <select
                      required
                      value={formData.operator}
                      onChange={(e) => setFormData({...formData, operator: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccione un operador</option>
                      {operators.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PH Nemo</label>
                  <input
                    type="text"
                    required
                    value={formData.phNemo}
                    onChange={(e) => setFormData({...formData, phNemo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Localizador de Operador</label>
                  <input
                    type="text"
                    required
                    value={formData.localizador}
                    onChange={(e) => setFormData({...formData, localizador: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Negocio SITI</label>
                  <input
                    type="text"
                    required
                    value={formData.siti}
                    onChange={(e) => setFormData({...formData, siti: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Pasajero</label>
                  <input
                    type="text"
                    required
                    value={formData.apellido}
                    onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Límite de Pago</label>
                  <input
                    type="date"
                    required
                    value={formData.limitePago}
                    onChange={(e) => setFormData({...formData, limitePago: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agente Vendedor</label>
                  <input
                    type="text"
                    required
                    value={formData.agente}
                    onChange={(e) => setFormData({...formData, agente: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Neto de la Reserva</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.valorNeto}
                      onChange={(e) => setFormData({...formData, valorNeto: e.target.value})}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingReservationId(null);
                    setFormData({
                      operator: '', phNemo: '', localizador: '', siti: '', 
                      apellido: '', limitePago: '', agente: '', valorNeto: ''
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingReservationId ? 'Actualizar Reserva' : 'Guardar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Operator Modal */}
      {showNewOperatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Operador</h3>
              <button onClick={() => setShowNewOperatorModal(false)} className="text-gray-400 hover:text-gray-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddOperator} className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Operador</label>
                <input
                  type="text"
                  required
                  value={newOperatorName}
                  onChange={(e) => setNewOperatorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 uppercase"
                  placeholder="Ej: NUEVO OPERADOR"
                />
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewOperatorModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Añadir Operador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reservation Confirmation Modal */}
      {reservationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar Reserva</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReservationToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteReservation(reservationToDelete);
                  setReservationToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Operator Confirmation Modal */}
      {operatorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar Operador</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar el operador <strong>{operatorToDelete}</strong>? 
              Las reservas asociadas a este operador no se eliminarán, pero ya no aparecerá en la lista.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOperatorToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteOperator(operatorToDelete);
                  if (activeTab === operatorToDelete) {
                    setActiveTab('RESUMEN');
                  }
                  setOperatorToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar Múltiples Reservas</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar las <strong>{selectedIds.size}</strong> reservas seleccionadas? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  batchDeleteReservations(Array.from(selectedIds));
                  setSelectedIds(new Set());
                  setShowBatchDeleteModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
              >
                Eliminar Todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
