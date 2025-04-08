import React, { useState } from 'react';
import axios from 'axios';
import { Button, Modal, message } from 'antd';
import { FileTextOutlined, LoadingOutlined } from '@ant-design/icons';

/**
 * Componente para adicionar à tabela de tratativas existente
 * Mostra um botão de regeneração de PDF apenas para tratativas sem documento
 * 
 * Props:
 * - tratativa: objeto com os dados da tratativa
 * - onDocumentoGerado: função a ser chamada quando um documento for gerado com sucesso
 */
const BotaoRegenerarPDF = ({ tratativa, onDocumentoGerado }) => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Não mostrar o botão se já houver uma URL de documento
  if (tratativa.url_documento_enviado) {
    return null;
  }
  
  const API_URL = 'https://iblogistica.ddns.net:3000/api/tratativa';
  
  // Função para regenerar um documento
  const regenerarDocumento = async (folhaUnica = false) => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/regenerate-pdf`, {
        id: tratativa.id,
        folhaUnica
      });
      
      if (response.data.status === 'success') {
        message.success(`Documento gerado com sucesso para ${tratativa.funcionario}`);
        // Notificar o componente pai que o documento foi gerado
        if (onDocumentoGerado) {
          onDocumentoGerado(response.data);
        }
      } else if (response.data.status === 'info') {
        message.info(response.data.message);
      } else {
        message.error(`Erro ao gerar documento: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Erro ao regenerar documento:', error);
      message.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };
  
  // Abrir o modal de confirmação
  const abrirModal = () => {
    setModalVisible(true);
  };
  
  return (
    <>
      <Button
        type="primary"
        icon={<FileTextOutlined />}
        size="small"
        onClick={abrirModal}
        title="Regenerar documento PDF"
      >
        PDF
      </Button>
      
      <Modal
        title="Gerar Documento"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <div>
          <p>Como deseja gerar o documento para a tratativa <strong>{tratativa.numero_tratativa}</strong>?</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
            <Button
              type="primary"
              loading={loading}
              onClick={() => regenerarDocumento(false)}
            >
              Documento Completo (2 folhas)
            </Button>
            
            <Button
              type="default"
              loading={loading}
              onClick={() => regenerarDocumento(true)}
            >
              Apenas Folha 1
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BotaoRegenerarPDF; 